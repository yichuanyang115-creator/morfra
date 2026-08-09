import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT_PREFERENCES, useLayoutStore } from "./layoutStore";

const STORAGE_KEY = "morfra.layout.preferences.v1";

describe("layoutStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useLayoutStore.setState({ ...DEFAULT_LAYOUT_PREFERENCES, hydrated: false });
  });

  it("启动时恢复应用级布局和外观偏好，并把存量宽度夹回安全范围", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...DEFAULT_LAYOUT_PREFERENCES,
      sidebarWidth: 999,
      detailWidth: 1,
      aiWidth: 999,
      appearanceMode: "dark",
    }));

    useLayoutStore.getState().hydrate();

    expect(useLayoutStore.getState()).toMatchObject({
      hydrated: true,
      sidebarWidth: 360,
      detailWidth: 360,
      aiWidth: 560,
      appearanceMode: "dark",
    });
  });

  it("调整宽度时立即持久化，窗口自动重排不需要改写这份偏好", () => {
    useLayoutStore.setState({ hydrated: true });
    useLayoutStore.getState().setDetailWidth(720);
    useLayoutStore.getState().setAiWidth(320);

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}")).toMatchObject({ detailWidth: 720, aiWidth: 320 });
  });
});
