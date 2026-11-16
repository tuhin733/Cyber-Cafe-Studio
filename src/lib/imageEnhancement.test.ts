import { describe, expect, it } from "vitest";
import { correctUnevenLighting } from "./imageEnhancement";

function createImage(width: number, height: number, color: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = color;
    pixels[index + 1] = color;
    pixels[index + 2] = color;
    pixels[index + 3] = 255;
  }
  return pixels;
}

describe("correctUnevenLighting", () => {
  it("lifts a shadowed page area while preserving its text and alpha", () => {
    const width = 128;
    const pixels = createImage(width, 64, 230);
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const index = (y * width + x) * 4;
        pixels[index] = 180;
        pixels[index + 1] = 180;
        pixels[index + 2] = 180;
      }
    }
    const textIndex = (32 * width + 32) * 4;
    pixels[textIndex] = 20;
    pixels[textIndex + 1] = 20;
    pixels[textIndex + 2] = 20;

    correctUnevenLighting(pixels, width, 64);

    expect(pixels[(32 * width + 16) * 4]).toBeGreaterThan(180);
    expect(pixels[(32 * width + 120) * 4]).toBe(230);
    expect(pixels[textIndex]).toBeGreaterThan(20);
    expect(pixels[textIndex]).toBeLessThan(pixels[(32 * width + 16) * 4]);
    expect(pixels[textIndex + 3]).toBe(255);
  });

  it("leaves evenly lit pages unchanged", () => {
    const pixels = createImage(128, 64, 220);

    const original = new Uint8ClampedArray(pixels);

    correctUnevenLighting(pixels, 128, 64);

    expect(pixels).toEqual(original);
  });

  it("rejects pixel data with mismatched dimensions", () => {
    expect(() =>
      correctUnevenLighting(new Uint8ClampedArray(4), 2, 1),
    ).toThrow(/dimensions must match/);
  });
});
