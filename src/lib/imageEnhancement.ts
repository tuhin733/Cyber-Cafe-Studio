const BACKGROUND_TILE_SIZE = 64;
const BACKGROUND_PERCENTILE = 0.8;
const MAX_LIGHTING_CORRECTION = 32;

interface ToneSettings {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  warmth?: number;
}

function applyTone(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  { brightness = 0, contrast = 1, saturation = 1, warmth = 0 }: ToneSettings,
) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const gray = 0.299 * red + 0.587 * green + 0.114 * blue;
    pixels[index] = (gray + (red - gray) * saturation - 128) * contrast + 128 + brightness + warmth;
    pixels[index + 1] = (gray + (green - gray) * saturation - 128) * contrast + 128 + brightness;
    pixels[index + 2] = (gray + (blue - gray) * saturation - 128) * contrast + 128 + brightness - warmth;
  }
  ctx.putImageData(imageData, 0, 0);
}

function applyGrayscale(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  contrast = 1,
  brightness = 0,
) {
  applyTone(ctx, width, height, { saturation: 0, contrast, brightness });
}

function applyDenoise(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const source = imageData.data;
  const output = new Uint8ClampedArray(source);
  const offsets = [
    -width * 4 - 4,
    -width * 4,
    -width * 4 + 4,
    -4,
    4,
    width * 4 - 4,
    width * 4,
    width * 4 + 4,
  ];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = (y * width + x) * 4;
      let minLuminance = 255;
      let maxLuminance = 0;
      let red = 0;
      let green = 0;
      let blue = 0;
      for (const offset of offsets) {
        const neighbor = index + offset;
        const luminance = 0.299 * source[neighbor] +
          0.587 * source[neighbor + 1] +
          0.114 * source[neighbor + 2];
        minLuminance = Math.min(minLuminance, luminance);
        maxLuminance = Math.max(maxLuminance, luminance);
        red += source[neighbor] / offsets.length;
        green += source[neighbor + 1] / offsets.length;
        blue += source[neighbor + 2] / offsets.length;
      }
      const centerLuminance = 0.299 * source[index] +
        0.587 * source[index + 1] +
        0.114 * source[index + 2];
      const averageLuminance = 0.299 * red + 0.587 * green + 0.114 * blue;
      if (maxLuminance - minLuminance < 40 && Math.abs(centerLuminance - averageLuminance) > 18) {
        output[index] = source[index] * 0.55 + red * 0.45;
        output[index + 1] = source[index + 1] * 0.55 + green * 0.45;
        output[index + 2] = source[index + 2] * 0.55 + blue * 0.45;
      }
    }
  }
  ctx.putImageData(new ImageData(output, width, height), 0, 0);
}

function applyShadowLift(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  for (let index = 0; index < pixels.length; index += 4) {
    for (let channel = 0; channel < 3; channel++) {
      const value = pixels[index + channel];
      const normalized = value / 255;
      pixels[index + channel] = value + (255 - value) * 0.18 * normalized * normalized;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function applyAutoContrast(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const histogram = new Uint32Array(256);
  for (let index = 0; index < pixels.length; index += 4) {
    const gray = Math.round(
      0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2],
    );
    histogram[gray]++;
  }

  const total = pixels.length / 4;
  const clipCount = Math.floor(total * 0.005);
  let low = 0;
  let high = 255;
  let cumulative = 0;
  for (; low < 255; low++) {
    cumulative += histogram[low];
    if (cumulative > clipCount) break;
  }
  cumulative = 0;
  for (; high > 0; high--) {
    cumulative += histogram[high];
    if (cumulative > clipCount) break;
  }
  if (high <= low) return;
  const range = high - low;
  for (let index = 0; index < pixels.length; index += 4) {
    const luminance = 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];
    const adjusted = Math.max(0, Math.min(255, (luminance - low) * 255 / range));
    const change = adjusted - luminance;
    pixels[index] += change;
    pixels[index + 1] += change;
    pixels[index + 2] += change;
  }
  ctx.putImageData(imageData, 0, 0);
}

function applyPaperWhitening(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const gray = 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];
    const amount = Math.max(0, Math.min(1, (gray - 170) / 75));
    const smoothAmount = amount * amount * (3 - 2 * amount);
    const whitened = gray + (255 - gray) * 0.9 * smoothAmount;
    pixels[index] = whitened;
    pixels[index + 1] = whitened;
    pixels[index + 2] = whitened;
  }
  ctx.putImageData(imageData, 0, 0);
}

function applySharpen(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength = 0.3,
) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const source = imageData.data;
  const output = new Uint8ClampedArray(source);
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        let sum = 0;
        let min = 255;
        let max = 0;
        let kernelIndex = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const neighbor = ((y + dy) * width + x + dx) * 4 + channel;
            const value = source[neighbor];
            min = Math.min(min, value);
            max = Math.max(max, value);
            sum += value * kernel[kernelIndex++];
          }
        }
        const sharpened = source[index + channel] +
          (sum - source[index + channel]) * strength;
        output[index + channel] = Math.max(min, Math.min(max, sharpened));
      }
    }
  }
  ctx.putImageData(new ImageData(output, width, height), 0, 0);
}

export function applyAutoEnhance(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  applyDenoise(ctx, width, height);
  applyShadowLift(ctx, width, height);
  applyAutoContrast(ctx, width, height);
  applySharpen(ctx, width, height, 0.25);
}

export function applyGrayscaleEnhancement(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const imageData = ctx.getImageData(0, 0, width, height);
  correctUnevenLighting(imageData.data, width, height);
  ctx.putImageData(imageData, 0, 0);
  applyGrayscale(ctx, width, height);
  applyAutoContrast(ctx, width, height);
  applySharpen(ctx, width, height, 0.3);
}

export function applyPhotocopyEnhancement(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const imageData = ctx.getImageData(0, 0, width, height);
  correctUnevenLighting(imageData.data, width, height);
  ctx.putImageData(imageData, 0, 0);
  applyGrayscale(ctx, width, height);
  applyAutoContrast(ctx, width, height);
  applySharpen(ctx, width, height, 0.24);
  applyPaperWhitening(ctx, width, height);
}

export interface AutoEnhancedImage {
  file: File;
  width: number;
  height: number;
}

export async function autoEnhanceImageFile(file: File): Promise<AutoEnhancedImage> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const loadedImage = new Image();
      loadedImage.onload = () => resolve(loadedImage);
      loadedImage.onerror = () => reject(new Error(`Could not decode ${file.name}`));
      loadedImage.src = sourceUrl;
    });
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error(`Could not process ${file.name}`);

    ctx.drawImage(image, 0, 0);
    applyAutoEnhance(ctx, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error(`Could not export enhanced image ${file.name}`));
      }, "image/png");
    });
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return {
      file: new File([blob], `${baseName}.png`, {
        type: "image/png",
        lastModified: file.lastModified,
      }),
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export function correctUnevenLighting(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    pixels.length !== width * height * 4
  ) {
    throw new RangeError("Image dimensions must match the RGBA pixel data.");
  }

  const columns = Math.ceil(width / BACKGROUND_TILE_SIZE);
  const rows = Math.ceil(height / BACKGROUND_TILE_SIZE);
  if (columns < 2 && rows < 2) return;

  const backgrounds = new Float32Array(columns * rows);
  const histogram = new Uint32Array(256);

  for (let tileY = 0; tileY < rows; tileY++) {
    for (let tileX = 0; tileX < columns; tileX++) {
      histogram.fill(0);
      const startX = tileX * BACKGROUND_TILE_SIZE;
      const startY = tileY * BACKGROUND_TILE_SIZE;
      const endX = Math.min(startX + BACKGROUND_TILE_SIZE, width);
      const endY = Math.min(startY + BACKGROUND_TILE_SIZE, height);
      let pixelCount = 0;

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const index = (y * width + x) * 4;
          const luminance = Math.round(
            0.299 * pixels[index] +
            0.587 * pixels[index + 1] +
            0.114 * pixels[index + 2],
          );
          histogram[luminance]++;
          pixelCount++;
        }
      }

      const target = Math.ceil(pixelCount * BACKGROUND_PERCENTILE);
      let cumulative = 0;
      let luminance = 0;
      for (; luminance < histogram.length - 1; luminance++) {
        cumulative += histogram[luminance];
        if (cumulative >= target) break;
      }
      backgrounds[tileY * columns + tileX] = luminance;
    }
  }

  const sortedBackgrounds = Array.from(backgrounds).sort((a, b) => a - b);
  const globalBackground =
    sortedBackgrounds[Math.min(
      sortedBackgrounds.length - 1,
      Math.floor(sortedBackgrounds.length * 0.75),
    )];

  for (let y = 0; y < height; y++) {
    const gridY = Math.max(
      0,
      Math.min(rows - 1, (y + 0.5) / BACKGROUND_TILE_SIZE - 0.5),
    );
    const top = Math.floor(gridY);
    const bottom = Math.min(top + 1, rows - 1);
    const yMix = gridY - top;

    for (let x = 0; x < width; x++) {
      const gridX = Math.max(
        0,
        Math.min(columns - 1, (x + 0.5) / BACKGROUND_TILE_SIZE - 0.5),
      );
      const left = Math.floor(gridX);
      const right = Math.min(left + 1, columns - 1);
      const xMix = gridX - left;
      const topBackground =
        backgrounds[top * columns + left] * (1 - xMix) +
        backgrounds[top * columns + right] * xMix;
      const bottomBackground =
        backgrounds[bottom * columns + left] * (1 - xMix) +
        backgrounds[bottom * columns + right] * xMix;
      const localBackground = topBackground * (1 - yMix) + bottomBackground * yMix;
      const correction = Math.min(
        MAX_LIGHTING_CORRECTION,
        (globalBackground - localBackground) * 0.65,
      );
      if (correction < 1) continue;

      const index = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        pixels[index + channel] += correction;
      }
    }
  }
}
