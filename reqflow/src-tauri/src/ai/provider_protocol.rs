use reqwest::{header::CONTENT_TYPE, Response, Url};

use super::errors::{AIError, AIErrorCode};
use super::provider_types::{
    ChatCompletionResponse, ChatMessage, StreamingChunk, MAX_CHAT_MESSAGES, MAX_CHAT_MESSAGE_BYTES,
    MAX_RESPONSE_BYTES,
};

pub fn normalize_base_url(base_url: &str, allow_http_localhost: bool) -> Result<Url, AIError> {
    let trimmed = base_url.trim().trim_end_matches('/');
    let parsed = Url::parse(trimmed).map_err(|_| {
        AIError::new(
            AIErrorCode::InvalidBaseUrl,
            "请输入有效的 HTTPS Base URL",
            false,
        )
    })?;
    let local_http = allow_http_localhost
        && parsed.scheme() == "http"
        && matches!(parsed.host_str(), Some("127.0.0.1" | "localhost"));
    if parsed.scheme() != "https" && !local_http {
        return Err(AIError::new(
            AIErrorCode::InvalidBaseUrl,
            "Base URL 必须使用 HTTPS",
            false,
        ));
    }
    if parsed.username() != ""
        || parsed.password().is_some()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
        || parsed.host_str().is_none()
    {
        return Err(AIError::new(
            AIErrorCode::InvalidBaseUrl,
            "Base URL 不得包含账号、密码、查询参数或片段",
            false,
        ));
    }
    Ok(parsed)
}

pub fn validate_provider_config_id(value: &str) -> Result<(), AIError> {
    if value.is_empty()
        || value.len() > 200
        || value.trim() != value
        || value
            .chars()
            .any(|character| character.is_whitespace() || matches!(character, '/' | '\\' | '\0'))
    {
        return Err(AIError::new(
            AIErrorCode::InvalidProviderConfig,
            "AI 服务配置标识无效",
            false,
        ));
    }
    Ok(())
}

pub fn validate_model_id(value: &str) -> Result<(), AIError> {
    if value.is_empty()
        || value.len() > 160
        || value.trim() != value
        || value.chars().any(char::is_whitespace)
    {
        return Err(AIError::new(
            AIErrorCode::InvalidModel,
            "模型 ID 不能为空、不能含空白或超过 160 个字符",
            false,
        ));
    }
    Ok(())
}

pub(crate) fn validate_messages(messages: &[ChatMessage]) -> Result<(), AIError> {
    if messages.is_empty()
        || messages.len() > MAX_CHAT_MESSAGES
        || messages.iter().any(|message| {
            message.content.is_empty()
                || !matches!(message.role.as_str(), "system" | "user" | "assistant")
        })
    {
        return Err(AIError::invalid_request("对话消息格式无效"));
    }
    let bytes: usize = messages.iter().map(|message| message.content.len()).sum();
    if bytes > MAX_CHAT_MESSAGE_BYTES {
        return Err(AIError::new(
            AIErrorCode::PayloadTooLarge,
            "请求内容过大，请缩短问题后重试",
            false,
        ));
    }
    Ok(())
}

pub fn is_event_stream(response: &Response) -> bool {
    response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.to_ascii_lowercase().contains("text/event-stream"))
}

pub async fn bounded_bytes(response: Response) -> Result<Vec<u8>, AIError> {
    if response
        .content_length()
        .is_some_and(|length| length as usize > MAX_RESPONSE_BYTES)
    {
        return Err(AIError::new(
            AIErrorCode::PayloadTooLarge,
            "AI 服务响应过大，已停止读取",
            true,
        ));
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|error| AIError::network(&error))?;
    if bytes.len() > MAX_RESPONSE_BYTES {
        return Err(AIError::new(
            AIErrorCode::PayloadTooLarge,
            "AI 服务响应过大，已停止读取",
            true,
        ));
    }
    Ok(bytes.to_vec())
}

pub fn parse_completion(body: &[u8]) -> Result<String, AIError> {
    let response: ChatCompletionResponse = serde_json::from_slice(body).map_err(|_| {
        AIError::new(
            AIErrorCode::InvalidResponse,
            "AI 服务返回了无法解析的回答",
            true,
        )
    })?;
    response
        .choices
        .first()
        .and_then(|choice| choice.message.as_ref())
        .and_then(|message| message.content.clone())
        .ok_or_else(|| {
            AIError::new(
                AIErrorCode::InvalidResponse,
                "AI 服务没有返回可显示的回答",
                true,
            )
        })
}

pub(crate) fn parse_stream_delta(data: &str) -> Result<Option<String>, AIError> {
    let chunk: StreamingChunk = serde_json::from_str(data)
        .map_err(|_| AIError::new(AIErrorCode::InvalidResponse, "流式响应 JSON 无效", false))?;
    Ok(chunk
        .choices
        .first()
        .and_then(|choice| choice.delta.as_ref())
        .and_then(|delta| delta.content.clone())
        .filter(|content| !content.is_empty()))
}
