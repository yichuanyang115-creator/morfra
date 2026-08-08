use reqwest::StatusCode;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AIErrorCode {
    InvalidProviderConfig,
    InvalidBaseUrl,
    InvalidModel,
    InvalidRequest,
    MissingApiKey,
    KeychainUnavailable,
    Unauthorized,
    ModelsUnavailable,
    ModelNotFound,
    RateLimited,
    NetworkUnavailable,
    ProviderError,
    InvalidResponse,
    StreamInterrupted,
    RequestCancelled,
    RequestInProgress,
    DataExfiltrationNotConfirmed,
    PayloadTooLarge,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AIError {
    pub code: AIErrorCode,
    pub message: String,
    pub retryable: bool,
}

impl AIError {
    pub fn new(code: AIErrorCode, message: &str, retryable: bool) -> Self {
        Self {
            code,
            message: message.to_string(),
            retryable,
        }
    }

    pub fn invalid_request(message: &str) -> Self {
        Self::new(AIErrorCode::InvalidRequest, message, false)
    }

    pub fn network(error: &reqwest::Error) -> Self {
        let retryable = error.is_timeout() || error.is_connect() || error.is_request();
        Self::new(
            AIErrorCode::NetworkUnavailable,
            "无法连接 AI 服务，请检查网络或地址后重试",
            retryable,
        )
    }

    pub fn from_status(status: StatusCode, models_request: bool) -> Self {
        match status {
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => Self::new(
                AIErrorCode::Unauthorized,
                "API Key 无效或没有访问权限，请检查服务配置",
                false,
            ),
            StatusCode::NOT_FOUND if models_request => Self::new(
                AIErrorCode::ModelsUnavailable,
                "该服务不提供可用的模型列表，请手填模型 ID 后单独测试",
                true,
            ),
            StatusCode::NOT_FOUND => Self::new(
                AIErrorCode::ModelNotFound,
                "模型不存在或当前服务不支持该模型，请检查模型 ID",
                false,
            ),
            StatusCode::TOO_MANY_REQUESTS => Self::new(
                AIErrorCode::RateLimited,
                "AI 服务当前限流，请稍后重试",
                true,
            ),
            status if status.is_client_error() => Self::new(
                AIErrorCode::ProviderError,
                "AI 服务拒绝了请求，请检查模型 ID 或请求格式",
                false,
            ),
            _ => Self::new(
                AIErrorCode::ProviderError,
                "AI 服务暂时不可用，请稍后重试",
                true,
            ),
        }
    }
}

impl std::fmt::Display for AIError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for AIError {}

#[cfg(test)]
mod tests {
    use super::{AIError, AIErrorCode};
    use reqwest::StatusCode;

    #[test]
    fn maps_provider_failures_to_stable_safe_codes() {
        assert_eq!(
            AIError::from_status(StatusCode::UNAUTHORIZED, false).code,
            AIErrorCode::Unauthorized
        );
        assert_eq!(
            AIError::from_status(StatusCode::NOT_FOUND, true).code,
            AIErrorCode::ModelsUnavailable
        );
        assert_eq!(
            AIError::from_status(StatusCode::NOT_FOUND, false).code,
            AIErrorCode::ModelNotFound
        );
        assert_eq!(
            AIError::from_status(StatusCode::TOO_MANY_REQUESTS, false).code,
            AIErrorCode::RateLimited
        );
    }

    #[test]
    fn structured_error_never_contains_provider_body() {
        let error = AIError::from_status(StatusCode::BAD_REQUEST, false);
        assert_eq!(error.code, AIErrorCode::ProviderError);
        assert!(!error.message.contains("provider-secret-body"));
    }
}
