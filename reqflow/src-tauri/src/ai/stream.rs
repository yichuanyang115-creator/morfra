use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};

use serde::Serialize;
use tauri::ipc::Channel;

use super::errors::{AIError, AIErrorCode};
use super::provider::{
    bounded_bytes, is_event_stream, parse_completion, ChatMessage, ProviderClient,
    MAX_RESPONSE_BYTES,
};
use super::provider_protocol::parse_stream_delta;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AIStreamEvent {
    Delta {
        request_id: String,
        content: String,
    },
    Complete {
        request_id: String,
        content: String,
        streamed: bool,
    },
    Error {
        request_id: String,
        error: AIError,
    },
}

#[derive(Clone, Default)]
pub struct ActiveRequestRegistry {
    active: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
}

impl ActiveRequestRegistry {
    pub fn begin(&self, request_id: &str) -> Result<(), AIError> {
        let mut active = self.active.lock().expect("AI request registry lock");
        if active.contains_key(request_id) {
            return Err(AIError::new(
                AIErrorCode::RequestInProgress,
                "同一请求正在生成中",
                false,
            ));
        }
        active.insert(request_id.to_string(), Arc::new(AtomicBool::new(false)));
        Ok(())
    }

    pub fn cancel(&self, request_id: &str) -> bool {
        let active = self.active.lock().expect("AI request registry lock");
        active.get(request_id).is_some_and(|cancelled| {
            cancelled.store(true, Ordering::Release);
            true
        })
    }

    pub fn is_active(&self, request_id: &str) -> bool {
        self.active
            .lock()
            .expect("AI request registry lock")
            .get(request_id)
            .is_some_and(|cancelled| !cancelled.load(Ordering::Acquire))
    }

    pub fn finish(&self, request_id: &str) {
        self.active
            .lock()
            .expect("AI request registry lock")
            .remove(request_id);
    }

    pub(crate) fn send(
        &self,
        request_id: &str,
        channel: &Channel<AIStreamEvent>,
        event: AIStreamEvent,
    ) -> Result<bool, AIError> {
        let active = self.active.lock().expect("AI request registry lock");
        let Some(cancelled) = active.get(request_id) else {
            return Ok(false);
        };
        if cancelled.load(Ordering::Acquire) {
            return Ok(false);
        }
        channel.send(event).map_err(|_| {
            AIError::new(AIErrorCode::NetworkUnavailable, "AI 流式通道已关闭", true)
        })?;
        Ok(true)
    }
}

#[derive(Debug, PartialEq, Eq)]
pub struct SseEvent {
    pub data: String,
}

#[derive(Default)]
pub struct SseParser {
    buffer: Vec<u8>,
    data: String,
    has_data: bool,
}

impl SseParser {
    pub fn push(&mut self, chunk: &[u8]) -> Result<Vec<SseEvent>, AIError> {
        self.buffer.extend_from_slice(chunk);
        self.take_complete_lines()
    }

    pub fn finish(&mut self) -> Result<Vec<SseEvent>, AIError> {
        let mut events = Vec::new();
        if !self.buffer.is_empty() {
            let line = std::mem::take(&mut self.buffer);
            self.process_line(&line, &mut events)?;
        }
        self.dispatch(&mut events);
        Ok(events)
    }

    fn take_complete_lines(&mut self) -> Result<Vec<SseEvent>, AIError> {
        let mut events = Vec::new();
        while let Some(position) = self.buffer.iter().position(|byte| *byte == b'\n') {
            let line: Vec<u8> = self.buffer.drain(..=position).collect();
            self.process_line(&line[..line.len() - 1], &mut events)?;
        }
        Ok(events)
    }

    fn process_line(&mut self, raw_line: &[u8], events: &mut Vec<SseEvent>) -> Result<(), AIError> {
        let line = raw_line.strip_suffix(b"\r").unwrap_or(raw_line);
        if line.is_empty() {
            self.dispatch(events);
            return Ok(());
        }
        let line = std::str::from_utf8(line).map_err(|_| {
            AIError::new(
                AIErrorCode::InvalidResponse,
                "流式响应包含非法 UTF-8",
                false,
            )
        })?;
        if let Some(value) = line.strip_prefix("data:") {
            let value = value.strip_prefix(' ').unwrap_or(value);
            if self.has_data {
                self.data.push('\n');
            }
            self.data.push_str(value);
            self.has_data = true;
        }
        Ok(())
    }

    fn dispatch(&mut self, events: &mut Vec<SseEvent>) {
        if self.has_data {
            events.push(SseEvent {
                data: std::mem::take(&mut self.data),
            });
            self.has_data = false;
        }
    }
}

pub enum StreamOutcome {
    Completed,
    Cancelled,
}

pub async fn stream_chat(
    client: &ProviderClient,
    request_id: &str,
    model_id: &str,
    messages: &[ChatMessage],
    channel: &Channel<AIStreamEvent>,
    registry: &ActiveRequestRegistry,
) -> Result<StreamOutcome, AIError> {
    let response = match client.send_chat_request(model_id, messages, true).await {
        Ok(response) => response,
        Err(error) if error.code == AIErrorCode::ProviderError => {
            client.send_chat_request(model_id, messages, false).await?
        }
        Err(error) => return Err(error),
    };
    if !is_event_stream(&response) {
        let content = parse_completion(&bounded_bytes(response).await?)?;
        if !registry.send(
            request_id,
            channel,
            AIStreamEvent::Delta {
                request_id: request_id.to_string(),
                content: content.clone(),
            },
        )? {
            return Ok(StreamOutcome::Cancelled);
        }
        if !registry.send(
            request_id,
            channel,
            AIStreamEvent::Complete {
                request_id: request_id.to_string(),
                content,
                streamed: false,
            },
        )? {
            return Ok(StreamOutcome::Cancelled);
        }
        return Ok(StreamOutcome::Completed);
    }

    let mut response = response;
    let mut parser = SseParser::default();
    let mut content = String::new();
    let mut done = false;
    let mut received_bytes = 0usize;
    while let Some(bytes) = response
        .chunk()
        .await
        .map_err(|error| AIError::network(&error))?
    {
        received_bytes = received_bytes.saturating_add(bytes.len());
        if received_bytes > MAX_RESPONSE_BYTES {
            return Err(AIError::new(
                AIErrorCode::PayloadTooLarge,
                "AI 服务响应过大，已停止读取",
                true,
            ));
        }
        if !registry.is_active(request_id) {
            return Ok(StreamOutcome::Cancelled);
        }
        for event in parser.push(&bytes)? {
            if event.data == "[DONE]" {
                done = true;
                continue;
            }
            if let Some(delta) = parse_stream_delta(&event.data)? {
                content.push_str(&delta);
                if !registry.send(
                    request_id,
                    channel,
                    AIStreamEvent::Delta {
                        request_id: request_id.to_string(),
                        content: delta.clone(),
                    },
                )? {
                    return Ok(StreamOutcome::Cancelled);
                }
            }
        }
    }
    for event in parser.finish()? {
        if event.data == "[DONE]" {
            done = true;
            continue;
        }
        if let Some(delta) = parse_stream_delta(&event.data)? {
            content.push_str(&delta);
            if !registry.send(
                request_id,
                channel,
                AIStreamEvent::Delta {
                    request_id: request_id.to_string(),
                    content: delta.clone(),
                },
            )? {
                return Ok(StreamOutcome::Cancelled);
            }
        }
    }
    if !done {
        if !registry.is_active(request_id) {
            return Ok(StreamOutcome::Cancelled);
        }
        return Err(AIError::new(
            AIErrorCode::StreamInterrupted,
            "AI 流式连接意外中断，请重试",
            true,
        ));
    }
    if !registry.send(
        request_id,
        channel,
        AIStreamEvent::Complete {
            request_id: request_id.to_string(),
            content,
            streamed: true,
        },
    )? {
        return Ok(StreamOutcome::Cancelled);
    }
    Ok(StreamOutcome::Completed)
}
