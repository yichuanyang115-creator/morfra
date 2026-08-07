import { describe, expect, it } from "vitest";
import { STAGE_PALETTE, nextPaletteColor, paletteColorAt, validateSchemaColor } from "./stagePalette";

describe("stagePalette", () => {
  it("使用 8 个稳定且不重复的绿紫色标记", () => {
    expect(STAGE_PALETTE).toHaveLength(8);
    expect(new Set(STAGE_PALETTE).size).toBe(STAGE_PALETTE.length);
    expect(STAGE_PALETTE.every((color) => /^#[0-9A-F]{6}$/i.test(color))).toBe(true);
    expect(STAGE_PALETTE.every((color) => !/^hsl/i.test(color))).toBe(true);
  });

  it("超过色板长度后按原顺序稳定轮询", () => {
    expect(paletteColorAt(0)).toBe(STAGE_PALETTE[0]);
    expect(paletteColorAt(STAGE_PALETTE.length)).toBe(STAGE_PALETTE[0]);
    expect(paletteColorAt(STAGE_PALETTE.length + 3)).toBe(STAGE_PALETTE[3]);
  });

  it("新增颜色优先避开删除后仍存在的颜色", () => {
    expect(nextPaletteColor([STAGE_PALETTE[0], STAGE_PALETTE[2]])).toBe(STAGE_PALETTE[1]);
  });

  it("颜色比较不区分大小写，预设色板耗尽后仍返回未占用的绿紫色", () => {
    expect(nextPaletteColor([STAGE_PALETTE[0].toLowerCase()])).toBe(STAGE_PALETTE[1]);
    const next = nextPaletteColor(STAGE_PALETTE);
    expect(STAGE_PALETTE).not.toContain(next);
    expect(next).toMatch(/^#[0-9A-F]{6}$/);

    const greenFallback = nextPaletteColor([...STAGE_PALETTE, ...Array.from({ length: 8 }, (_, i) => `#1010${String(i).padStart(2, "0")}`)]);
    expect(greenFallback).toMatch(/^#[0-9A-F]{6}$/);
    const greenChannels = [1, 3, 5].map((offset) => Number.parseInt(greenFallback.slice(offset, offset + 2), 16));
    expect(greenChannels[1]).toBeGreaterThan(greenChannels[0]);
    expect(greenChannels[1]).toBeGreaterThan(greenChannels[2]);

    const purpleFallback = nextPaletteColor([...STAGE_PALETTE, ...Array.from({ length: 9 }, (_, i) => `#2020${String(i).padStart(2, "0")}`)]);
    const purpleChannels = [1, 3, 5].map((offset) => Number.parseInt(purpleFallback.slice(offset, offset + 2), 16));
    expect(purpleChannels[2]).toBeGreaterThan(purpleChannels[0]);
    expect(purpleChannels[0]).toBeGreaterThan(purpleChannels[1]);
  });

  it("手动颜色必须满足白底 3:1 对比度", () => {
    expect(validateSchemaColor("#B5D7A8")).toEqual({ valid: false, message: "颜色过浅，在白色背景上不可辨识" });
    expect(validateSchemaColor(STAGE_PALETTE[0])).toEqual({ valid: true });
  });
});
