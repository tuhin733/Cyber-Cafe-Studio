import { describe, expect, it } from "vitest";
import {
  getModelInputDimensions,
  MAX_MODEL_INPUT_DIMENSION,
} from "./backgroundRemoverUtils";

describe("getModelInputDimensions", () => {
  it("keeps small images at their original dimensions", () => {
    expect(getModelInputDimensions(1280, 720)).toEqual({
      width: 1280,
      height: 720,
    });
  });

  it("scales large images proportionally to the model limit", () => {
    expect(getModelInputDimensions(6000, 4000)).toEqual({
      width: MAX_MODEL_INPUT_DIMENSION,
      height: 1365,
    });
  });

  it("rejects invalid dimensions", () => {
    expect(() => getModelInputDimensions(0, 10)).toThrow(
      "Invalid image dimensions.",
    );
    expect(() => getModelInputDimensions(10.5, 10)).toThrow(
      "Invalid image dimensions.",
    );
  });
});
