import { fetch } from "@tauri-apps/plugin-http";
import { isNewerVersion } from "./semver";

const OWNER = "yichuanyang115-creator";
const REPO = "reqflow";

export interface ReleaseInfo {
  version: string;
  notes: string;
  assetUrl: string;
}

export interface CheckUpdateResult {
  hasUpdate: boolean;
  release?: ReleaseInfo;
}

interface GithubAsset {
  name: string;
  browser_download_url: string;
}

interface GithubRelease {
  tag_name: string;
  body: string | null;
  assets: GithubAsset[];
}

/** GitHub `/releases/latest` 语义上已排除 draft 和 prerelease，无需自己再过滤（Product-Spec REQ-023）。 */
export async function checkForUpdate(currentVersion: string): Promise<CheckUpdateResult> {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`);
  if (!res.ok) {
    throw new Error(`GitHub API 请求失败（${res.status}）`);
  }
  const data = (await res.json()) as GithubRelease;

  if (!isNewerVersion(data.tag_name, currentVersion)) {
    return { hasUpdate: false };
  }

  const asset = data.assets.find((a) => /aarch64/i.test(a.name) && /\.dmg$/i.test(a.name));
  if (!asset) {
    throw new Error("未找到可下载的 Apple Silicon dmg 安装包");
  }

  return {
    hasUpdate: true,
    release: { version: data.tag_name, notes: data.body ?? "", assetUrl: asset.browser_download_url },
  };
}
