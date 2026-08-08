use serde::{Deserialize, Serialize};

pub const MAX_CHAT_MESSAGES: usize = 100;
pub const MAX_CHAT_MESSAGE_BYTES: usize = 256 * 1024;
pub const MAX_RESPONSE_BYTES: usize = 4 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ModelListResult {
    pub model_ids: Vec<String>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CapabilitySupport {
    Supported,
    Unsupported,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityProbe {
    pub model_id: String,
    pub chat_available: bool,
    pub models: CapabilitySupport,
    pub streaming: CapabilitySupport,
    pub structured_output: CapabilitySupport,
    pub tool_calls: CapabilitySupport,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ModelsResponse {
    pub(crate) data: Vec<ModelItem>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ModelItem {
    pub(crate) id: String,
}

#[derive(Debug, Deserialize)]
pub struct ChatCompletionResponse {
    pub choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
pub struct ChatChoice {
    pub message: Option<ChatMessageContent>,
}

#[derive(Debug, Deserialize)]
pub struct ChatMessageContent {
    pub content: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StreamingChunk {
    pub choices: Vec<StreamingChoice>,
}

#[derive(Debug, Deserialize)]
pub struct StreamingChoice {
    pub delta: Option<StreamingDelta>,
}

#[derive(Debug, Deserialize)]
pub struct StreamingDelta {
    pub content: Option<String>,
}
