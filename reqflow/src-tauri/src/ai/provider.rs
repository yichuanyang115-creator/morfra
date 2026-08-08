use std::time::Duration;

use reqwest::{header::CONTENT_TYPE, Client, Response, Url};
use serde_json::json;

use super::errors::{AIError, AIErrorCode};
use super::stream::SseParser;

use super::provider_protocol::validate_messages;
pub use super::provider_protocol::{
    bounded_bytes, is_event_stream, normalize_base_url, parse_completion, validate_model_id,
    validate_provider_config_id,
};
use super::provider_types::ModelsResponse;
pub use super::provider_types::{
    CapabilityProbe, CapabilitySupport, ChatMessage, ModelListResult, StreamingChunk,
    MAX_RESPONSE_BYTES,
};

pub struct ProviderClient {
    client: Client,
    base_url: Url,
    api_key: String,
}

impl ProviderClient {
    pub fn new(base_url: &str, api_key: String) -> Result<Self, AIError> {
        Self::build(base_url, api_key, false)
    }

    #[cfg(test)]
    pub fn new_for_test(base_url: &str, api_key: String) -> Result<Self, AIError> {
        Self::build(base_url, api_key, true)
    }

    fn build(base_url: &str, api_key: String, allow_http_localhost: bool) -> Result<Self, AIError> {
        let normalized = normalize_base_url(base_url, allow_http_localhost)?;
        if api_key.trim().is_empty() || api_key.contains(['\n', '\r']) {
            return Err(AIError::new(
                AIErrorCode::MissingApiKey,
                "请先配置 API Key",
                false,
            ));
        }
        let mut client_builder = Client::builder();
        if allow_http_localhost {
            client_builder = client_builder.no_proxy();
        }
        let client = client_builder
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(120))
            .user_agent("ReqFlow AI Assistant")
            .build()
            .map_err(|_| {
                AIError::new(
                    AIErrorCode::NetworkUnavailable,
                    "AI 网络客户端初始化失败",
                    true,
                )
            })?;
        Ok(Self {
            client,
            base_url: normalized,
            api_key,
        })
    }

    pub async fn list_models(&self) -> Result<ModelListResult, AIError> {
        let response = self
            .client
            .get(self.endpoint("models")?)
            .bearer_auth(&self.api_key)
            .header("accept", "application/json")
            .send()
            .await
            .map_err(|error| AIError::network(&error))?;
        if !response.status().is_success() {
            return Err(AIError::from_status(response.status(), true));
        }
        let body = bounded_bytes(response).await?;
        let payload: ModelsResponse = serde_json::from_slice(&body).map_err(|_| {
            AIError::new(
                AIErrorCode::InvalidResponse,
                "模型列表响应格式无效，请手填模型 ID",
                true,
            )
        })?;
        let mut model_ids = Vec::new();
        for item in payload.data {
            let id = item.id.trim();
            if !id.is_empty() && !model_ids.iter().any(|existing| existing == id) {
                model_ids.push(id.to_string());
            }
        }
        if model_ids.is_empty() {
            return Err(AIError::new(
                AIErrorCode::InvalidResponse,
                "模型列表为空，请手填模型 ID",
                true,
            ));
        }
        Ok(ModelListResult {
            model_ids,
            source: "remote".to_string(),
        })
    }

    pub async fn probe(&self, model_id: &str) -> Result<CapabilityProbe, AIError> {
        validate_model_id(model_id)?;
        let messages = vec![ChatMessage {
            role: "user".to_string(),
            content: "ping".to_string(),
        }];
        let streamed = match self.send_chat_request(model_id, &messages, true).await {
            Ok(response) => response,
            Err(error) if error.code == AIErrorCode::ProviderError => {
                self.send_chat_request(model_id, &messages, false).await?
            }
            Err(error) => return Err(error),
        };
        let streaming = if is_event_stream(&streamed) {
            let body = bounded_bytes(streamed).await?;
            validate_probe_sse(&body)?;
            CapabilitySupport::Supported
        } else {
            parse_completion(&bounded_bytes(streamed).await?)?;
            CapabilitySupport::Unsupported
        };
        Ok(CapabilityProbe {
            model_id: model_id.to_string(),
            chat_available: true,
            models: CapabilitySupport::Unknown,
            streaming,
            structured_output: CapabilitySupport::Unknown,
            tool_calls: CapabilitySupport::Unknown,
        })
    }

    pub async fn send_chat_request(
        &self,
        model_id: &str,
        messages: &[ChatMessage],
        stream: bool,
    ) -> Result<Response, AIError> {
        validate_model_id(model_id)?;
        validate_messages(messages)?;
        let payload = json!({ "model": model_id, "messages": messages, "stream": stream });
        let response = self
            .client
            .post(self.endpoint("chat/completions")?)
            .bearer_auth(&self.api_key)
            .header(CONTENT_TYPE, "application/json")
            .body(
                serde_json::to_vec(&payload)
                    .map_err(|_| AIError::invalid_request("请求格式无效"))?,
            )
            .send()
            .await
            .map_err(|error| AIError::network(&error))?;
        if !response.status().is_success() {
            return Err(AIError::from_status(response.status(), false));
        }
        Ok(response)
    }

    fn endpoint(&self, route: &str) -> Result<Url, AIError> {
        let mut url = self.base_url.clone();
        let base_path = url.path().trim_end_matches('/');
        url.set_path(&format!("{base_path}/{route}"));
        Ok(url)
    }
}

fn validate_probe_sse(body: &[u8]) -> Result<(), AIError> {
    let mut parser = SseParser::default();
    let mut events = parser.push(body)?;
    events.extend(parser.finish()?);
    let mut saw_json = false;
    let mut saw_done = false;
    for event in events {
        if event.data == "[DONE]" {
            saw_done = true;
            continue;
        }
        serde_json::from_str::<StreamingChunk>(&event.data)
            .map_err(|_| AIError::new(AIErrorCode::InvalidResponse, "流式响应 JSON 无效", true))?;
        saw_json = true;
    }
    if !saw_json || !saw_done {
        return Err(AIError::new(
            AIErrorCode::StreamInterrupted,
            "AI 流式响应未正常结束，请重试",
            true,
        ));
    }
    Ok(())
}
