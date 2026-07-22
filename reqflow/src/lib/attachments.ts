import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import type { DeliverableAttach } from "../types/models";

export async function pickAttachmentFile(): Promise<DeliverableAttach | null> {
  const path = await openFileDialog({ multiple: false, directory: false });
  if (!path) return null;
  const label = path.split(/[\\/]/).pop() ?? path;
  return { type: "file", url: path, label };
}

export function linkAttachmentFromUrl(url: string): DeliverableAttach {
  return { type: "link", url, label: url };
}

export async function openAttachment(attach: DeliverableAttach): Promise<void> {
  if (attach.type === "file") {
    await openPath(attach.url);
  } else {
    await openUrl(attach.url);
  }
}
