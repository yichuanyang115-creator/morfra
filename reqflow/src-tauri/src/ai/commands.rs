use serde::{Deserialize, Serialize};

use super::keychain::{NativeKeychainStore, SecretStore, SecretStoreError};

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

#[cfg(test)]
mod tests {
    use super::{delete_with_store, set_secret_with_store, status_with_store, SetSecretRequest};
    use crate::ai::keychain::{SecretStore, SecretStoreError};
    use std::collections::HashMap;

    fn test_secret() -> String {
        ["transient", "value"].join("-")
    }

    #[derive(Default)]
    struct FakeStore {
        values: std::sync::Mutex<HashMap<String, String>>,
    }

    impl SecretStore for FakeStore {
        fn set(&self, account: &str, secret: &str) -> Result<(), SecretStoreError> {
            self.values
                .lock()
                .expect("fake store lock")
                .insert(account.to_string(), secret.to_string());
            Ok(())
        }

        fn status(&self, account: &str) -> Result<bool, SecretStoreError> {
            Ok(self
                .values
                .lock()
                .expect("fake store lock")
                .contains_key(account))
        }

        fn delete(&self, account: &str) -> Result<(), SecretStoreError> {
            self.values.lock().expect("fake store lock").remove(account);
            Ok(())
        }
    }

    struct ErrorStore(SecretStoreError);

    impl SecretStore for ErrorStore {
        fn set(&self, _account: &str, _secret: &str) -> Result<(), SecretStoreError> {
            Err(self.0)
        }

        fn status(&self, _account: &str) -> Result<bool, SecretStoreError> {
            Err(self.0)
        }

        fn delete(&self, _account: &str) -> Result<(), SecretStoreError> {
            Err(self.0)
        }
    }

    #[test]
    fn command_boundary_never_returns_secret_and_covers_lifecycle() {
        let store = FakeStore::default();
        let request = SetSecretRequest {
            provider_config_id: "provider-test".to_string(),
            secret: test_secret(),
        };
        assert_eq!(set_secret_with_store(&store, &request), Ok(()));
        assert_eq!(status_with_store(&store, "provider-test"), Ok(true));
        assert_eq!(delete_with_store(&store, "provider-test"), Ok(()));
        assert_eq!(status_with_store(&store, "provider-test"), Ok(false));
    }

    #[test]
    fn command_boundary_rejects_invalid_inputs() {
        let store = FakeStore::default();
        assert_eq!(
            status_with_store(&store, "../provider").unwrap_err().code,
            "invalid_provider_config"
        );
        assert_eq!(
            set_secret_with_store(
                &store,
                &SetSecretRequest {
                    provider_config_id: "provider-test".to_string(),
                    secret: "\n".to_string()
                }
            )
            .unwrap_err()
            .code,
            "invalid_secret"
        );
    }

    #[test]
    fn command_boundary_maps_store_failures_to_safe_structured_errors() {
        let request = SetSecretRequest {
            provider_config_id: "provider-test".to_string(),
            secret: test_secret(),
        };
        assert_eq!(
            set_secret_with_store(&ErrorStore(SecretStoreError::OperationFailed), &request)
                .unwrap_err()
                .code,
            "keychain_operation_failed"
        );
        assert_eq!(
            status_with_store(
                &ErrorStore(SecretStoreError::StorageUnavailable),
                "provider-test"
            )
            .unwrap_err()
            .code,
            "keychain_unavailable"
        );
        assert_eq!(
            delete_with_store(
                &ErrorStore(SecretStoreError::OperationFailed),
                "provider-test"
            )
            .unwrap_err()
            .code,
            "keychain_operation_failed"
        );
    }
}
