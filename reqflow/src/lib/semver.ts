/** 三段式 semver 版本号解析：`v1.2.3` 或 `1.2.3`，忽略 pre-release/build 后缀。解析失败返回 null。 */
export function parseSemver(raw: string): [number, number, number] | null {
  const match = raw.trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** 比较两个 semver 版本号：a > b 返回 1，a < b 返回 -1，相等返回 0。任一解析失败按字符串相等处理，返回 0。 */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1;
  }
  return 0;
}

export function isNewerVersion(latest: string, current: string): boolean {
  return compareSemver(latest, current) > 0;
}
