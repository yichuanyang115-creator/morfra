use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

use super::errors::{AIError, AIErrorCode};
use super::keychain::{NativeKeychainStore, SecretStore, SecretStoreError};
use super::provider::{
    validate_model_id, validate_provider_config_id as validate_network_provider_config_id,
    CapabilityProbe, ChatMessage, ModelListResult, ProviderClient,
};
use super::stream::{stream_chat, AIStreamEvent, ActiveRequestRegistry, StreamOutcome};

#[derive(Debug, Deserialize)]
pub struct SetSecretRequest {
    pub provider_config_id: String,
    pub secret: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct KeychainCommandError {
    pub code: &'static str,
    pub message: &'static str,
}

impl KeychainCommandError {
    const fn new(code: &'static str, message: &'static str) -> Self {
        Self { code, message }
    }
}

fn validate_provider_config_id(provider_config_id: &str) -> Result<(), KeychainCommandError> {
    if provider_config_id.is_empty()
        || provider_config_id.len() > 200
        || provider_config_id.trim() != provider_config_id
        || provider_config_id.chars().any(|character| {
            character == '/' || character == '\\' || character == '\0' || character.is_whitespace()
        })
    {
        return Err(KeychainCommandError::new(
            "invalid_provider_config",
            "AI 服务配置标识无效",
        ));
    }
    Ok(())
}

fn map_store_error(error: SecretStoreError) -> KeychainCommandError {
    match error {
        SecretStoreError::InvalidAccount => {
            KeychainCommandError::new("invalid_provider_config", "AI 服务配置标识无效")
        }
        SecretStoreError::InvalidSecret => {
            KeychainCommandError::new("invalid_secret", "API Key 不能为空且不能包含换行")
        }
        SecretStoreError::StorageUnavailable => KeychainCommandError::new(
            "keychain_unavailable",
            "系统密钥存储不可用，请检查 macOS Keychain 后重试",
        ),
        SecretStoreError::OperationFailed => KeychainCommandError::new(
            "keychain_operation_failed",
            "macOS Keychain 操作失败，请重试",
        ),
    }
}

fn map_secret_error(error: SecretStoreError) -> AIError {
    match error {
        SecretStoreError::InvalidAccount => AIError::new(
            AIErrorCode::InvalidProviderConfig,
            "AI 服务配置标识无效",
            false,
        ),
        SecretStoreError::InvalidSecret => {
            AIError::new(AIErrorCode::MissingApiKey, "请先配置 API Key", false)
        }
        SecretStoreError::StorageUnavailable => AIError::new(
            AIErrorCode::KeychainUnavailable,
            "系统密钥存储不可用，请检查 macOS Keychain 后重试",
            true,
        ),
        SecretStoreError::OperationFailed => AIError::new(
            AIErrorCode::KeychainUnavailable,
            "读取 macOS Keychain 失败，请重试",
            true,
        ),
    }
}

fn ensure_external_request_allowed(confirmed: bool) -> Result<(), AIError> {
    if confirmed {
        Ok(())
    } else {
        Err(AIError::new(
            AIErrorCode::DataExfiltrationNotConfirmed,
            "请先确认数据外传说明，再测试或发送请求",
            false,
        ))
    }
}

fn load_provider_client(
    provider_config_id: &str,
    base_url: &str,
) -> Result<ProviderClient, AIError> {
    validate_network_provider_config_id(provider_config_id)?;
    let api_key = NativeKeychainStore
        .get(provider_config_id)
        .map_err(map_secret_error)?
        .ok_or_else(|| AIError::new(AIErrorCode::MissingApiKey, "请先配置 API Key", false))?;
    ProviderClient::new(base_url, api_key)
}

#[tauri::command]
pub async fn list_ai_models(
    provider_config_id: String,
    base_url: String,
    data_exfiltration_confirmed: bool,
) -> Result<ModelListResult, AIError> {
    ensure_external_request_allowed(data_exfiltration_confirmed)?;
    load_provider_client(&provider_config_id, &base_url)?
        .list_models()
        .await
}

#[tauri::command]
pub async fn test_ai_provider(
    provider_config_id: String,
    base_url: String,
    model_id: String,
    data_exfiltration_confirmed: bool,
) -> Result<CapabilityProbe, AIError> {
    ensure_external_request_allowed(data_exfiltration_confirmed)?;
    validate_model_id(&model_id)?;
    load_provider_client(&provider_config_id, &base_url)?
        .probe(&model_id)
        .await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIChatRequest {
    pub request_id: String,
    pub provider_config_id: String,
    pub base_url: String,
    pub model_id: String,
    pub messages: Vec<ChatMessage>,
    pub data_exfiltration_confirmed: bool,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RequestHandle {
    pub request_id: String,
}

fn validate_request_id(request_id: &str) -> Result<(), AIError> {
    if request_id.is_empty()
        || request_id.len() > 200
        || request_id.trim() != request_id
        || request_id.chars().any(char::is_whitespace)
    {
        return Err(AIError::invalid_request("请求标识无效"));
    }
    Ok(())
}

#[tauri::command]
pub async fn start_ai_chat(
    request: AIChatRequest,
    channel: Channel<AIStreamEvent>,
    state: tauri::State<'_, ActiveRequestRegistry>,
) -> Result<RequestHandle, AIError> {
    ensure_external_request_allowed(request.data_exfiltration_confirmed)?;
    validate_request_id(&request.request_id)?;
    let client = load_provider_client(&request.provider_config_id, &request.base_url)?;
    validate_model_id(&request.model_id)?;
    let registry = state.inner().clone();
    registry.begin(&request.request_id)?;
    let request_id = request.request_id.clone();
    let task_request_id = request_id.clone();
    let model_id = request.model_id.clone();
    let messages = request.messages;
    let task_registry = registry.clone();
    tauri::async_runtime::spawn(async move {
        let result = stream_chat(
            &client,
            &task_request_id,
            &model_id,
            &messages,
            &channel,
            &task_registry,
        )
        .await;
        match result {
            Err(error) => {
                let _ = task_registry.send(
                    &task_request_id,
                    &channel,
                    AIStreamEvent::Error {
                        request_id: task_request_id.clone(),
                        error,
                    },
                );
            }
            Ok(StreamOutcome::Cancelled) | Ok(StreamOutcome::Completed) => {
                // 取消由前端本地恢复输入状态；取消后不再发送任何迟到片段。
            }
        }
        task_registry.finish(&task_request_id);
    });
    Ok(RequestHandle { request_id })
}

#[tauri::command]
pub async fn cancel_ai_chat(
    request_id: String,
    state: tauri::State<'_, ActiveRequestRegistry>,
) -> Result<(), AIError> {
    validate_request_id(&request_id)?;
    state.inner().cancel(&request_id);
    Ok(())
}

pub fn set_secret_with_store<S: SecretStore>(
    store: &S,
    request: &SetSecretRequest,
) -> Result<(), KeychainCommandError> {
    validate_provider_config_id(&request.provider_config_id)?;
    if request.secret.trim().is_empty() || request.secret.contains(['\n', '\r']) {
        return Err(KeychainCommandError::new(
            "invalid_secret",
            "API Key 不能为空且不能包含换行",
        ));
    }
    store
        .set(&request.provider_config_id, &request.secret)
        .map_err(map_store_error)
}

pub fn status_with_store<S: SecretStore>(
    store: &S,
    provider_config_id: &str,
) -> Result<bool, KeychainCommandError> {
    validate_provider_config_id(provider_config_id)?;
    store.status(provider_config_id).map_err(map_store_error)
}

pub fn delete_with_store<S: SecretStore>(
    store: &S,
    provider_config_id: &str,
) -> Result<(), KeychainCommandError> {
    validate_provider_config_id(provider_config_id)?;
    store.delete(provider_config_id).map_err(map_store_error)
}

#[tauri::command]
pub fn set_ai_provider_secret(
    provider_config_id: String,
    secret: String,
) -> Result<(), KeychainCommandError> {
    set_secret_with_store(
        &NativeKeychainStore,
        &SetSecretRequest {
            provider_config_id,
            secret,
        },
    )
}

#[tauri::command]
pub fn ai_provider_secret_status(provider_config_id: String) -> Result<bool, KeychainCommandError> {
    status_with_store(&NativeKeychainStore, &provider_config_id)
}

#[tauri::command]
pub fn delete_ai_provider_secret(provider_config_id: String) -> Result<(), KeychainCommandError> {
    delete_with_store(&NativeKeychainStore, &provider_config_id)
}
