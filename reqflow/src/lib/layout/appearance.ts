import type { AppearanceMode } from "../../stores/layoutStore";

export type EffectiveAppearance = "light" | "dark";

function prefersDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function effectiveAppearance(mode: AppearanceMode): EffectiveAppearance {
  return mode === "system" ? (prefersDark() ? "dark" : "light") : mode;
}

export function applyAppearanceMode(mode: AppearanceMode, root: HTMLElement = document.documentElement): EffectiveAppearance {
  root.dataset.appearance = mode;
  root.style.colorScheme = effectiveAppearance(mode);
  return effectiveAppearance(mode);
}

export function applyAccessibilityPreferences(root: HTMLElement = document.documentElement): void {
  const reducedMotion = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reducedTransparency = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-transparency: reduce)").matches;
  root.dataset.reducedMotion = String(reducedMotion);
  root.dataset.reducedTransparency = String(reducedTransparency);
}

export function subscribeToSystemAppearance(listener: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener?.("change", listener);
  return () => query.removeEventListener?.("change", listener);
}

export function subscribeToAccessibilityPreferences(listener: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const queries = [
    window.matchMedia("(prefers-reduced-motion: reduce)"),
    window.matchMedia("(prefers-reduced-transparency: reduce)"),
  ];
  queries.forEach((query) => query.addEventListener?.("change", listener));
  return () => queries.forEach((query) => query.removeEventListener?.("change", listener));
}
