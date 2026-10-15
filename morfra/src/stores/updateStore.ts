import { create } from "zustand";
import { getVersion } from "@tauri-apps/api/app";
import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { download } from "@tauri-apps/plugin-upload";
import { pathExists, removeFile } from "../lib/fs";
import { checkForUpdate, type ReleaseInfo } from "../lib/updater";

export type UpdateStatus = "idle" | "checking" | "up-to-date" | "available" | "downloading" | "error";

interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  release: ReleaseInfo | null;
  downloadProgress: number;
  errorMessage: string;
  loadVersion: () => Promise<void>;
  checkUpdate: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
}

async function downloadFilePath(): Promise<string> {
  return join(await appLocalDataDir(), "morfra-update.dmg");
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  status: "idle",
  currentVersion: "",
  release: null,
  downloadProgress: 0,
  errorMessage: "",

  loadVersion: async () => {
    try {
      const version = await getVersion();
      set({ currentVersion: version, status: "idle", errorMessage: "" });
    } catch (e) {
      set({ status: "error", errorMessage: e instanceof Error ? e.message : "无法读取当前版本，请重试" });
    }
  },

  checkUpdate: async () => {
    set({ status: "checking", errorMessage: "" });
    try {
      const result = await checkForUpdate(get().currentVersion);
      if (result.hasUpdate && result.release) {
        set({ status: "available", release: result.release });
      } else {
        set({ status: "up-to-date", release: null });
      }
    } catch (e) {
      set({ status: "error", errorMessage: e instanceof Error ? e.message : "网络请求失败，请检查网络后重试" });
    }
  },

  downloadUpdate: async () => {
    const release = get().release;
    if (!release) return;

    set({ status: "downloading", downloadProgress: 0, errorMessage: "" });
    let filePath: string | null = null;

    try {
      filePath = await downloadFilePath();
      await download(release.assetUrl, filePath, (progress) => {
        if (progress.total > 0) {
          set({ downloadProgress: Math.round((progress.progress / progress.total) * 100) });
        }
      });
      await openPath(filePath);
      set({ status: "up-to-date", release: null });
    } catch (e) {
      if (filePath && await pathExists(filePath)) {
        await removeFile(filePath);
      }
      set({ status: "error", errorMessage: e instanceof Error ? e.message : "下载失败，请重试" });
    }
  },
}));
