import { invoke } from "@tauri-apps/api/core";

export const AI_KEYCHAIN_SERVICE = "reqflow.ai.provider";

export async function setAIProviderSecret(providerConfigId: string, secret: string): Promise<void> {
  await invoke<void>("set_ai_provider_secret", { providerConfigId, secret });
}

export async function hasAIProviderSecret(providerConfigId: string): Promise<boolean> {
  return invoke<boolean>("ai_provider_secret_status", { providerConfigId });
}

export async function deleteAIProviderSecret(providerConfigId: string): Promise<void> {
  await invoke<void>("delete_ai_provider_secret", { providerConfigId });
}
