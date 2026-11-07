import { describe, expect, it } from "vitest";
import {
  formatFileSize,
  getCoverCrop,
  getImageExtension,
  IMAGE_PRESETS,
  millimetresToPixels,
  validateOutputDimensions,
} from "./imageTools";

describe("millimetresToPixels", () => {
  it("converts print dimensions at 300 DPI", () => {
    expect(millimetresToPixels(35, 300)).toBe(413);
    expect(millimetresToPixels(45, 300)).toBe(531);
  });

  it("rejects invalid measurements", () => {
    expect(() => millimetresToPixels(0, 300)).toThrow(/positive/);
    expect(() => millimetresToPixels(10, Number.NaN)).toThrow(/positive/);
  });
});

describe("image size presets", () => {
  it("uses the supplied preset dimensions and DPI", () => {
    expect(IMAGE_PRESETS.find((preset) => preset.id === "ssc-photo")).toMatchObject({
      width: 413,
      height: 531,
      dpi: 300,
    });
    expect(IMAGE_PRESETS.find((preset) => preset.id === "upsc-photo")).toMatchObject({
      width: 500,
      height: 500,
      dpi: 300,
    });
    expect(IMAGE_PRESETS.find((preset) => preset.id === "pan-photo")).toMatchObject({
      width: 213,
      height: 213,
      dpi: 200,
    });
    expect(IMAGE_PRESETS).toHaveLength(19);
    expect([...new Set(IMAGE_PRESETS.map((preset) => preset.group))]).toEqual([
      "universal",
      "identity",
      "government",
    ]);
  });
});

describe("validateOutputDimensions", () => {
  it("accepts safe whole-pixel dimensions", () => {
    expect(() => validateOutputDimensions(1200, 1800)).not.toThrow();
  });

  it("rejects invalid and oversized output dimensions", () => {
    expect(() => validateOutputDimensions(0, 100)).toThrow(/positive whole pixels/);
    expect(() => validateOutputDimensions(10.5, 100)).toThrow(/positive whole pixels/);
    expect(() => validateOutputDimensions(6000, 6000)).toThrow(/safety limit/);
  });
});

describe("getCoverCrop", () => {
  it("calculates a centered crop matching the output aspect ratio", () => {
    expect(getCoverCrop(200, 100, 100, 100)).toEqual({
      x: 50,
      y: 0,
      width: 100,
      height: 100,
    });
  });

  it("supports zoom and keeps the crop inside the source image", () => {
    expect(getCoverCrop(200, 100, 100, 100, 2, 0, 1)).toEqual({
      x: 0,
      y: 50,
      width: 50,
      height: 50,
    });
  });
});

describe("image output helpers", () => {
  it("uses the correct download extension for each format", () => {
    expect(getImageExtension("image/jpeg")).toBe("jpg");
    expect(getImageExtension("image/png")).toBe("png");
    expect(getImageExtension("image/webp")).toBe("webp");
  });

  it("formats file sizes for the output summary", () => {
    expect(formatFileSize(800)).toBe("800 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(1_572_864)).toBe("1.50 MB");
  });
});
