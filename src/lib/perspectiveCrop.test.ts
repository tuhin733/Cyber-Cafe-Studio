import { describe, expect, it } from "vitest";
import { isValidQuad, type Quad } from "./perspectiveCrop";

describe("isValidQuad", () => {
  it("accepts rectangles and perspective quads", () => {
    const perspectiveQuad: Quad = {
      tl: { x: 10, y: 20 },
      tr: { x: 90, y: 10 },
      br: { x: 85, y: 80 },
      bl: { x: 15, y: 90 },
    };

    expect(isValidQuad(perspectiveQuad)).toBe(true);
  });

  it("rejects crossed, concave, and degenerate crop points", () => {
    expect(isValidQuad({
      tl: { x: 0, y: 0 },
      tr: { x: 1, y: 1 },
      br: { x: 1, y: 0 },
      bl: { x: 0, y: 1 },
    })).toBe(false);
    expect(isValidQuad({
      tl: { x: 0, y: 0 },
      tr: { x: 1, y: 0 },
      br: { x: 0.3, y: 0.3 },
      bl: { x: 0, y: 1 },
    })).toBe(false);
    expect(isValidQuad({
      tl: { x: 0, y: 0 },
      tr: { x: 0.5, y: 0 },
      br: { x: 1, y: 0 },
      bl: { x: 0, y: 1 },
    })).toBe(false);
  });
});