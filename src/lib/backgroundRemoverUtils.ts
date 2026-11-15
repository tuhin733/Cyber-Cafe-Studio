export const MAX_BACKGROUND_REMOVAL_PIXELS = 25_000_000;
export const MAX_MODEL_INPUT_DIMENSION = 2048;

export function getModelInputDimensions(width: number, height: number) {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1
  ) {
    throw new Error("Invalid image dimensions.");
  }

  const scale = Math.min(
    1,
    MAX_MODEL_INPUT_DIMENSION / Math.max(width, height),
  );
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
