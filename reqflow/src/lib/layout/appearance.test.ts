import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyAccessibilityPreferences,
  applyAppearanceMode,
  effectiveAppearance,
  subscribeToAccessibilityPreferences,
  subscribeToSystemAppearance,
} from "./appearance";

type MediaListener = () => void;

function installMediaPreferences(preferences: Record<string, boolean>) {
  const listeners = new Map<string, Set<MediaListener>>();
  const matchMedia = vi.fn((query: string) => ({
    matches: preferences[query] ?? false,
    addEventListener: (_event: string, listener: MediaListener) => {
      const queryListeners = listeners.get(query) ?? new Set<MediaListener>();
      queryListeners.add(listener);
      listeners.set(query, queryListeners);
    },
    removeEventListener: (_event: string, listener: MediaListener) => listeners.get(query)?.delete(listener),
  }));
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    emit(query: string) {
      listeners.get(query)?.forEach((listener) => listener());
    },
  };
}

describe("外观与系统辅助功能偏好", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute("data-appearance");
    document.documentElement.removeAttribute("data-reduced-motion");
    document.documentElement.removeAttribute("data-reduced-transparency");
    document.documentElement.style.removeProperty("color-scheme");
  });

  it("跟随系统在系统外观变化后会重新应用浅深色，而显式偏好不受影响", () => {
    const preferences = { "(prefers-color-scheme: dark)": true };
    installMediaPreferences(preferences);
    const root = document.createElement("div");

    expect(effectiveAppearance("system")).toBe("dark");
    expect(applyAppearanceMode("system", root)).toBe("dark");
    expect(root.dataset).toMatchObject({ appearance: "system" });
    expect(root.style.colorScheme).toBe("dark");

    preferences["(prefers-color-scheme: dark)"] = false;
    expect(applyAppearanceMode("system", root)).toBe("light");
    expect(applyAppearanceMode("dark", root)).toBe("dark");
  });

  it("系统外观和减少动态/透明度订阅均可触发并在取消订阅后停止", () => {
    const media = installMediaPreferences({
      "(prefers-color-scheme: dark)": false,
      "(prefers-reduced-motion: reduce)": true,
      "(prefers-reduced-transparency: reduce)": true,
    });
    const appearanceListener = vi.fn();
    const accessibilityListener = vi.fn();
    const stopAppearance = subscribeToSystemAppearance(appearanceListener);
    const stopAccessibility = subscribeToAccessibilityPreferences(accessibilityListener);

    media.emit("(prefers-color-scheme: dark)");
    media.emit("(prefers-reduced-motion: reduce)");
    media.emit("(prefers-reduced-transparency: reduce)");
    expect(appearanceListener).toHaveBeenCalledOnce();
    expect(accessibilityListener).toHaveBeenCalledTimes(2);

    stopAppearance();
    stopAccessibility();
    media.emit("(prefers-color-scheme: dark)");
    media.emit("(prefers-reduced-motion: reduce)");
    expect(appearanceListener).toHaveBeenCalledOnce();
    expect(accessibilityListener).toHaveBeenCalledTimes(2);
  });

  it("读取 macOS 减少动态和降低透明度偏好并显式反映到根节点", () => {
    installMediaPreferences({
      "(prefers-reduced-motion: reduce)": true,
      "(prefers-reduced-transparency: reduce)": true,
    });
    const root = document.createElement("div");

    applyAccessibilityPreferences(root);

    expect(root.dataset).toMatchObject({ reducedMotion: "true", reducedTransparency: "true" });
  });
});
