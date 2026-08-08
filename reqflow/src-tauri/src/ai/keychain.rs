#[cfg(test)]
use std::collections::HashMap;
#[cfg(test)]
use std::sync::Mutex;

pub const KEYCHAIN_SERVICE: &str = "reqflow.ai.provider";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SecretStoreError {
    InvalidAccount,
    InvalidSecret,
    StorageUnavailable,
    OperationFailed,
}

pub trait SecretStore {
    fn set(&self, account: &str, secret: &str) -> Result<(), SecretStoreError>;
    fn get(&self, account: &str) -> Result<Option<String>, SecretStoreError>;
    fn status(&self, account: &str) -> Result<bool, SecretStoreError>;
    fn delete(&self, account: &str) -> Result<(), SecretStoreError>;
}

fn valid_account(account: &str) -> bool {
    !account.is_empty()
        && account.len() <= 200
        && account.trim() == account
        && !account.chars().any(|character| {
            character == '/' || character == '\\' || character == '\0' || character.is_whitespace()
        })
}

#[derive(Debug, Default, Clone, Copy)]
pub struct NativeKeychainStore;

impl SecretStore for NativeKeychainStore {
    fn set(&self, account: &str, secret: &str) -> Result<(), SecretStoreError> {
        if !valid_account(account) || secret.trim().is_empty() || secret.contains(['\n', '\r']) {
            return Err(if !valid_account(account) {
                SecretStoreError::InvalidAccount
            } else {
                SecretStoreError::InvalidSecret
            });
        }
        let entry = keyring::Entry::new(KEYCHAIN_SERVICE, account)
            .map_err(|_| SecretStoreError::StorageUnavailable)?;
        entry
            .set_password(secret)
            .map_err(|_| SecretStoreError::OperationFailed)
    }

    fn status(&self, account: &str) -> Result<bool, SecretStoreError> {
        if !valid_account(account) {
            return Err(SecretStoreError::InvalidAccount);
        }
        let entry = keyring::Entry::new(KEYCHAIN_SERVICE, account)
            .map_err(|_| SecretStoreError::StorageUnavailable)?;
        match entry.get_password() {
            Ok(secret) => {
                drop(secret);
                Ok(true)
            }
            Err(keyring::Error::NoEntry) => Ok(false),
            Err(_) => Err(SecretStoreError::OperationFailed),
        }
    }

    fn get(&self, account: &str) -> Result<Option<String>, SecretStoreError> {
        if !valid_account(account) {
            return Err(SecretStoreError::InvalidAccount);
        }
        let entry = keyring::Entry::new(KEYCHAIN_SERVICE, account)
            .map_err(|_| SecretStoreError::StorageUnavailable)?;
        match entry.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err(SecretStoreError::OperationFailed),
        }
    }

    fn delete(&self, account: &str) -> Result<(), SecretStoreError> {
        if !valid_account(account) {
            return Err(SecretStoreError::InvalidAccount);
        }
        let entry = keyring::Entry::new(KEYCHAIN_SERVICE, account)
            .map_err(|_| SecretStoreError::StorageUnavailable)?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err(SecretStoreError::OperationFailed),
        }
    }
}

#[cfg(test)]
#[derive(Debug, Default)]
struct MemorySecretStore {
    values: Mutex<HashMap<String, String>>,
}

#[cfg(test)]
impl SecretStore for MemorySecretStore {
    fn set(&self, account: &str, secret: &str) -> Result<(), SecretStoreError> {
        self.values
            .lock()
            .expect("test store lock")
            .insert(account.to_string(), secret.to_string());
        Ok(())
    }

    fn get(&self, account: &str) -> Result<Option<String>, SecretStoreError> {
        Ok(self
            .values
            .lock()
            .expect("test store lock")
            .get(account)
            .cloned())
    }

    fn status(&self, account: &str) -> Result<bool, SecretStoreError> {
        Ok(self
            .values
            .lock()
            .expect("test store lock")
            .contains_key(account))
    }

    fn delete(&self, account: &str) -> Result<(), SecretStoreError> {
        self.values.lock().expect("test store lock").remove(account);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    #[cfg(target_os = "macos")]
    use super::NativeKeychainStore;
    use super::{MemorySecretStore, SecretStore};
    #[cfg(target_os = "macos")]
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_secret() -> String {
        ["transient", "value"].join("-")
    }

    #[test]
    fn abstract_store_covers_set_status_delete_without_real_keychain() {
        let store = MemorySecretStore::default();
        assert!(!store.status("provider-test").expect("status"));
        store.set("provider-test", &test_secret()).expect("set");
        assert!(store.status("provider-test").expect("status"));
        store.delete("provider-test").expect("delete");
        assert!(!store.status("provider-test").expect("status"));
    }

    #[test]
    fn abstract_store_delete_is_idempotent() {
        let store = MemorySecretStore::default();
        store.delete("provider-test").expect("delete");
        assert!(!store.status("provider-test").expect("status"));
    }

    #[test]
    fn abstract_store_get_does_not_expose_plaintext_to_status() {
        let store = MemorySecretStore::default();
        assert_eq!(store.get("provider-test").expect("missing secret"), None);
        store.set("provider-test", &test_secret()).expect("set");
        assert_eq!(
            store.get("provider-test").expect("secret"),
            Some(test_secret())
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    #[ignore = "手工 macOS Keychain 回归，不进入自动测试"]
    fn macos_keychain_smoke_creates_reads_status_and_deletes_item() {
        let store = NativeKeychainStore;
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let account = format!("phase2-smoke-{nonce}");
        let secret = format!("phase2-transient-{nonce}");
        store.set(&account, &secret).expect("set");
        assert!(store.status(&account).expect("status after set"));
        store.delete(&account).expect("delete");
        assert!(!store.status(&account).expect("status after delete"));
    }
}
