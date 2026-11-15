import {
  pipeline,
  type BackgroundRemovalPipeline,
  type ProgressInfo,
} from "@huggingface/transformers";
import { getModelInputDimensions } from "./backgroundRemoverUtils";

export const MODNET_MODEL_ID = "Xenova/modnet";
export const MODNET_MODEL_REVISION =
  "fa2fa546052fba4c08921230a26cc69a333fca12";

let modelPromise: Promise<BackgroundRemovalPipeline> | null = null;

export async function removePortraitBackground(
  image: HTMLImageElement,
  onProgress?: (info: ProgressInfo) => void,
): Promise<{ blob: Blob; width: number; height: number }> {
  if (!modelPromise) {
    modelPromise = pipeline("background-removal", MODNET_MODEL_ID, {
      revision: MODNET_MODEL_REVISION,
      dtype: "fp32",
      progress_callback: onProgress,
    }).catch((error: unknown) => {
      modelPromise = null;
      throw error;
    });
  }

  const model = await modelPromise;
  const inputDimensions = getModelInputDimensions(
    image.naturalWidth,
    image.naturalHeight,
  );
  const inputCanvas = document.createElement("canvas");
  inputCanvas.width = inputDimensions.width;
  inputCanvas.height = inputDimensions.height;
  const context = inputCanvas.getContext("2d");
  if (!context) throw new Error("Image processing is unavailable.");
  context.drawImage(image, 0, 0, inputCanvas.width, inputCanvas.height);

  const result = await model(inputCanvas);
  if (result.channels !== 4) {
    throw new Error("The portrait model returned an invalid transparency mask.");
  }

  const maskBlob = await result.toBlob("image/png");
  if (
    !(maskBlob instanceof Blob) ||
    maskBlob.size === 0 ||
    maskBlob.type !== "image/png"
  ) {
    throw new Error("The portrait cutout could not be exported as a PNG.");
  }

  const maskImage = await createImageBitmap(maskBlob);
  try {
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = image.naturalWidth;
    outputCanvas.height = image.naturalHeight;
    const outputContext = outputCanvas.getContext("2d");
    if (!outputContext) throw new Error("Image processing is unavailable.");
    outputContext.drawImage(image, 0, 0);
    outputContext.globalCompositeOperation = "destination-in";
    outputContext.drawImage(maskImage, 0, 0, outputCanvas.width, outputCanvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      outputCanvas.toBlob((output) => {
        if (output) resolve(output);
        else reject(new Error("The portrait cutout could not be exported as a PNG."));
      }, "image/png");
    });
    if (blob.size === 0 || blob.type !== "image/png") {
      throw new Error("The portrait cutout could not be exported as a PNG.");
    }

    return { blob, width: outputCanvas.width, height: outputCanvas.height };
  } finally {
    maskImage.close();
  }
}
