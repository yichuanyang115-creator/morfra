use super::commands::{
    delete_with_store, set_secret_with_store, status_with_store, SetSecretRequest,
};
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

    fn get(&self, account: &str) -> Result<Option<String>, SecretStoreError> {
        Ok(self
            .values
            .lock()
            .expect("fake store lock")
            .get(account)
            .cloned())
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

    fn get(&self, _account: &str) -> Result<Option<String>, SecretStoreError> {
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
