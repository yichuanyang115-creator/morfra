import { describe, expect, it } from "vitest";
import { compareSemver, isNewerVersion, parseSemver } from "./semver";

describe("parseSemver", () => {
  it("解析带 v 前缀的 tag", () => {
    expect(parseSemver("v1.2.3")).toEqual([1, 2, 3]);
  });

  it("解析不带前缀的裸版本号", () => {
    expect(parseSemver("0.1.0")).toEqual([0, 1, 0]);
  });

  it("忽略 pre-release 后缀，只取三段式主体", () => {
    expect(parseSemver("v2.0.0-beta.1")).toEqual([2, 0, 0]);
  });

  it("格式不合法返回 null", () => {
    expect(parseSemver("not-a-version")).toBeNull();
  });
});

describe("compareSemver", () => {
  it("major 更大判定更新", () => {
    expect(compareSemver("v2.0.0", "v1.9.9")).toBe(1);
  });

  it("minor 更大判定更新", () => {
    expect(compareSemver("v1.3.0", "v1.2.9")).toBe(1);
  });

  it("patch 更大判定更新", () => {
    expect(compareSemver("v1.2.4", "v1.2.3")).toBe(1);
  });

  it("版本相同返回 0", () => {
    expect(compareSemver("v1.2.3", "1.2.3")).toBe(0);
  });

  it("a 更旧返回 -1", () => {
    expect(compareSemver("v1.0.0", "v1.0.1")).toBe(-1);
  });
});

describe("isNewerVersion", () => {
  it("latest 大于 current 时返回 true", () => {
    expect(isNewerVersion("v1.1.0", "v1.0.0")).toBe(true);
  });

  it("latest 等于 current 时返回 false，不触发有新版本状态", () => {
    expect(isNewerVersion("v1.0.0", "v1.0.0")).toBe(false);
  });

  it("latest 小于 current 时返回 false", () => {
    expect(isNewerVersion("v0.9.0", "v1.0.0")).toBe(false);
  });
});
