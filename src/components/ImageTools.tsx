import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowDownToLine,
  Crop,
  FlipHorizontal,
  FlipVertical,
  FileArchive,
  FileImage,
  ImagePlus,
  LoaderCircle,
  Minus,
  Scaling,
  Plus,
  RotateCcw,
  RotateCw,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import BackToToolsButton from "./BackToToolsButton";
import Dropdown from "./Dropdown";
import InputField from "./InputField";
import {
  formatFileSize,
  getCoverCrop,
  getImageExtension,
  IMAGE_PRESETS,
  validateOutputDimensions,
  type ImageFormat,
} from "../lib/imageTools";
import {
  applyPerspectiveTransform,
  isValidQuad,
  type Quad,
} from "../lib/perspectiveCrop";
import { getThemeColor } from "../theme/theme";
import { useToolAutoSave } from "../hooks/useToolAutoSave";
import AutoSaveStatusIndicator from "./AutoSaveStatusIndicator";

type ToolMode = "resize" | "compress" | "convert" | "crop";
type CompressionMode = "target" | "quality";
interface LoadedImage {
  file: File;
  url: string;
  image: HTMLImageElement;
}
interface ProcessedImage {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  format: ImageFormat;
}

interface ImageToolsSession {
  version: 1;
  sourceFile: File | null;
  result: Omit<ProcessedImage, "url"> | null;
  mode: ToolMode;
  width: number;
  height: number;
  dpi: number;
  selectedPresetId: string;
  customDimensions: boolean;
  cropZoom: number;
  cropCenter: { x: number; y: number };
  perspectiveCropEnabled: boolean;
  perspectiveCropPoints: Quad | null;
  rotation: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  format: ImageFormat;
  quality: number;
  targetKB: number;
  compressionMode: CompressionMode;
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const DEFAULT_QUALITY = 84;
const UPLOAD_COPY: Record<ToolMode, string> = {
  resize: "Upload photo or signature",
  crop: "Upload image to crop",
  compress: "Upload image to compress",
  convert: "Upload image to convert",
};

function loadImage(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ file, url, image });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Unable to open ${file.name}. The image may be damaged or unsupported.`));
    };
    image.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ImageFormat,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("The image could not be exported. Try smaller dimensions."));
          return;
        }
        if (blob.type !== format) {
          reject(new Error(`This browser can't export ${format.replace("image/", "").toUpperCase()} images.`));
          return;
        }
        resolve(blob);
      },
      format,
      quality / 100,
    );
  });
}

async function encodeToTargetSize(
  canvas: HTMLCanvasElement,
  format: ImageFormat,
  quality: number,
  targetBytes: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  let width = canvas.width;
  let height = canvas.height;
  let workingCanvas = canvas;

  for (let resizeAttempt = 0; resizeAttempt <= 12; resizeAttempt++) {
    let low = 10;
    let high = quality;
    let bestBlob: Blob | null = null;
    let bestQualityBlob: Blob | null = null;

    while (low <= high) {
      const currentQuality = Math.floor((low + high) / 2);
      const blob = await canvasToBlob(workingCanvas, format, currentQuality);
      if (!bestQualityBlob || blob.size < bestQualityBlob.size) bestQualityBlob = blob;
      if (blob.size <= targetBytes) {
        bestBlob = blob;
        low = currentQuality + 1;
      } else {
        high = currentQuality - 1;
      }
    }

    if (bestBlob) return { blob: bestBlob, width, height };
    if (resizeAttempt === 12 || !bestQualityBlob) {
      if (bestQualityBlob) return { blob: bestQualityBlob, width, height };
      throw new Error("Unable to compress this image.");
    }

    width = Math.max(1, Math.floor(width * 0.85));
    height = Math.max(1, Math.floor(height * 0.85));
    const resizedCanvas = document.createElement("canvas");
    resizedCanvas.width = width;
    resizedCanvas.height = height;
    const context = resizedCanvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable.");
    context.drawImage(workingCanvas, 0, 0, width, height);
    workingCanvas = resizedCanvas;
  }

  throw new Error("Unable to compress this image.");
}

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "") || "image";
}

function isImageFormat(value: unknown): value is ImageFormat {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp";
}

function formatFromFile(file: File): ImageFormat {
  return file.type === "image/png" || file.type === "image/webp"
    ? file.type
    : "image/jpeg";
}

function actionButtonClass(disabled = false): string {
  return `inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
    disabled
      ? "cursor-not-allowed bg-ui text-ink-faint"
      : "bg-action text-ink-inverse hover:bg-action-hover"
  }`;
}

function getPreviewFrame(
  boundsWidth: number,
  boundsHeight: number,
  aspectRatio: number,
) {
  const frameWidth = Math.min(boundsWidth * 0.84, boundsHeight * 0.84 * aspectRatio);
  const frameHeight = frameWidth / aspectRatio;
  return {
    x: (boundsWidth - frameWidth) / 2,
    y: (boundsHeight - frameHeight) / 2,
    width: frameWidth,
    height: frameHeight,
  };
}

function getOrientedImageSize(image: HTMLImageElement, rotation: number) {
  return rotation % 180 === 0
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : { width: image.naturalHeight, height: image.naturalWidth };
}

function getContainedImageBounds(
  boundsWidth: number,
  boundsHeight: number,
  imageWidth: number,
  imageHeight: number,
) {
  const scale = Math.min(boundsWidth / imageWidth, boundsHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    x: (boundsWidth - width) / 2,
    y: (boundsHeight - height) / 2,
    width,
    height,
  };
}

function getPerspectiveCropSize(quad: Quad, width: number, height: number) {
  const top = Math.hypot((quad.tr.x - quad.tl.x) * width, (quad.tr.y - quad.tl.y) * height);
  const bottom = Math.hypot((quad.br.x - quad.bl.x) * width, (quad.br.y - quad.bl.y) * height);
  const left = Math.hypot((quad.bl.x - quad.tl.x) * width, (quad.bl.y - quad.tl.y) * height);
  const right = Math.hypot((quad.br.x - quad.tr.x) * width, (quad.br.y - quad.tr.y) * height);
  return {
    width: Math.max(1, Math.round(Math.max(top, bottom))),
    height: Math.max(1, Math.round(Math.max(left, right))),
  };
}

type CropPoint = keyof Quad;
type CropEdge = "top" | "right" | "bottom" | "left";
type CropDragTarget = { point: CropPoint } | { edge: CropEdge } | { whole: true };

function getCropEdgePoints(edge: CropEdge): [CropPoint, CropPoint] {
  switch (edge) {
    case "top": return ["tl", "tr"];
    case "right": return ["tr", "br"];
    case "bottom": return ["bl", "br"];
    case "left": return ["tl", "bl"];
  }
}

function getCropEdgeMidpoint(quad: Quad, edge: CropEdge) {
  const [first, second] = getCropEdgePoints(edge);
  return {
    x: (quad[first].x + quad[second].x) / 2,
    y: (quad[first].y + quad[second].y) / 2,
  };
}

function getCropEdgeAngle(quad: Quad, edge: CropEdge) {
  const [first, second] = getCropEdgePoints(edge);
  return Math.atan2(
    quad[second].y - quad[first].y,
    quad[second].x - quad[first].x,
  ) * (180 / Math.PI);
}

function moveRectCropCorner(
  quad: Quad,
  corner: CropPoint,
  x: number,
  y: number,
  minimumX: number,
  minimumY: number,
): Quad {
  const next = { ...quad };
  if (corner === "tl") {
    next.tl = { x: Math.min(x, next.tr.x - minimumX), y: Math.min(y, next.bl.y - minimumY) };
    next.tr = { ...next.tr, y: next.tl.y };
    next.bl = { ...next.bl, x: next.tl.x };
  } else if (corner === "tr") {
    next.tr = { x: Math.max(x, next.tl.x + minimumX), y: Math.min(y, next.br.y - minimumY) };
    next.tl = { ...next.tl, y: next.tr.y };
    next.br = { ...next.br, x: next.tr.x };
  } else if (corner === "br") {
    next.br = { x: Math.max(x, next.bl.x + minimumX), y: Math.max(y, next.tr.y + minimumY) };
    next.bl = { ...next.bl, y: next.br.y };
    next.tr = { ...next.tr, x: next.br.x };
  } else {
    next.bl = { x: Math.min(x, next.br.x - minimumX), y: Math.max(y, next.tl.y + minimumY) };
    next.br = { ...next.br, y: next.bl.y };
    next.tl = { ...next.tl, x: next.bl.x };
  }
  return next;
}

export default function ImageTools({ onClose }: { onClose: () => void }) {
  const [source, setSource] = useState<LoadedImage | null>(null);
  const [result, setResult] = useState<ProcessedImage | null>(null);
  const [mode, setMode] = useState<ToolMode>("resize");
  const [width, setWidth] = useState(413);
  const [height, setHeight] = useState(531);
  const [dpi, setDpi] = useState(300);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [customDimensions, setCustomDimensions] = useState(false);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropCenter, setCropCenter] = useState({ x: 0.5, y: 0.5 });
  const [perspectiveCropEnabled, setPerspectiveCropEnabled] = useState(false);
  const [perspectiveCropPoints, setPerspectiveCropPoints] = useState<Quad | null>(null);
  const [rotation, setRotation] = useState(0);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [flipVertical, setFlipVertical] = useState(false);
  const [format, setFormat] = useState<ImageFormat>("image/jpeg");
  const [quality, setQuality] = useState(DEFAULT_QUALITY);
  const [targetKB, setTargetKB] = useState(100);
  const [compressionMode, setCompressionMode] = useState<CompressionMode>("target");
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [downloadToast, setDownloadToast] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const perspectiveOverlayRef = useRef<SVGSVGElement>(null);
  const perspectiveDragRef = useRef<{
    pointerId: number;
    target: CropDragTarget;
    startX: number;
    startY: number;
    initialPoints: Quad;
  } | null>(null);
  const cropDragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const sourceRef = useRef(source);
  const loadRequestRef = useRef(0);
  const processRequestRef = useRef(0);
  sourceRef.current = source;

  const restoreSession = useCallback(async (saved: ImageToolsSession) => {
    if (
      saved.version !== 1 ||
      (saved.sourceFile !== null && !(saved.sourceFile instanceof File)) ||
      !["resize", "crop", "compress", "convert"].includes(saved.mode) ||
      !isImageFormat(saved.format) ||
      (saved.result !== null &&
        (!(saved.result.blob instanceof Blob) ||
          !isImageFormat(saved.result.format) ||
          !Number.isSafeInteger(saved.result.width) ||
          saved.result.width < 1 ||
          !Number.isSafeInteger(saved.result.height) ||
          saved.result.height < 1))
    ) {
      throw new Error("The saved Image Tools session is invalid.");
    }

    let restoredSource: LoadedImage | null = null;
    if (saved.sourceFile) restoredSource = await loadImage(saved.sourceFile);

    if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url);
    setSource(restoredSource);
    setResult(
      saved.result
        ? { ...saved.result, url: URL.createObjectURL(saved.result.blob) }
        : null,
    );
    setMode(saved.mode);
    setWidth(saved.width);
    setHeight(saved.height);
    setDpi(saved.dpi);
    setSelectedPresetId(saved.selectedPresetId);
    setCustomDimensions(saved.customDimensions);
    setCropZoom(saved.cropZoom);
    setCropCenter(saved.cropCenter);
    setPerspectiveCropEnabled(saved.perspectiveCropEnabled);
    setPerspectiveCropPoints(saved.perspectiveCropPoints);
    setRotation(saved.rotation);
    setFlipHorizontal(saved.flipHorizontal);
    setFlipVertical(saved.flipVertical);
    setFormat(saved.format);
    setQuality(saved.quality);
    setTargetKB(saved.targetKB);
    setCompressionMode(saved.compressionMode);
  }, []);

  const autosaveSnapshot = useMemo<ImageToolsSession>(() => ({
    version: 1,
    sourceFile: source?.file ?? null,
    result: result
      ? {
          blob: result.blob,
          width: result.width,
          height: result.height,
          format: result.format,
        }
      : null,
    mode,
    width,
    height,
    dpi,
    selectedPresetId,
    customDimensions,
    cropZoom,
    cropCenter,
    perspectiveCropEnabled,
    perspectiveCropPoints,
    rotation,
    flipHorizontal,
    flipVertical,
    format,
    quality,
    targetKB,
    compressionMode,
  }), [
    compressionMode,
    cropCenter,
    cropZoom,
    customDimensions,
    dpi,
    flipHorizontal,
    flipVertical,
    format,
    height,
    mode,
    perspectiveCropEnabled,
    perspectiveCropPoints,
    quality,
    result,
    rotation,
    selectedPresetId,
    source,
    targetKB,
    width,
  ]);
  const autoSave = useToolAutoSave(
    "image-tools",
    autosaveSnapshot,
    restoreSession,
    !isLoading && !isProcessing,
  );

  useEffect(() => {
    return () => {
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  useEffect(() => {
    if (!downloadToast) return;
    const timeoutId = window.setTimeout(() => setDownloadToast(false), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [downloadToast]);

  const loadFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || !file.size) {
      setError("Choose a valid image file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("Choose an image smaller than 50 MB.");
      return;
    }

    setError("");
    setNotice("");
    setIsLoading(true);
    const requestId = ++loadRequestRef.current;
    try {
      const loaded = await loadImage(file);
      if (requestId !== loadRequestRef.current) {
        URL.revokeObjectURL(loaded.url);
        return;
      }
      if (loaded.image.naturalWidth * loaded.image.naturalHeight > 100_000_000) {
        URL.revokeObjectURL(loaded.url);
        throw new Error("This image is too large to process safely.");
      }
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url);
      sourceRef.current = loaded;
      setSource(loaded);
      setResult(null);
      setWidth(loaded.image.naturalWidth);
      setHeight(loaded.image.naturalHeight);
      setFormat(formatFromFile(file));
      setSelectedPresetId("");
      setCustomDimensions(false);
      setCropZoom(1);
      setCropCenter({ x: 0.5, y: 0.5 });
      setPerspectiveCropEnabled(false);
      setPerspectiveCropPoints({
        tl: { x: 0.05, y: 0.05 },
        tr: { x: 0.95, y: 0.05 },
        br: { x: 0.95, y: 0.95 },
        bl: { x: 0.05, y: 0.95 },
      });
      setRotation(0);
      setFlipHorizontal(false);
      setFlipVertical(false);
    } catch (loadError) {
      if (requestId !== loadRequestRef.current) return;
      console.error("Unable to load image for Image Tools", loadError);
      setError(loadError instanceof Error ? loadError.message : "The image could not be opened.");
    } finally {
      if (requestId === loadRequestRef.current) setIsLoading(false);
    }
  };

  const selectMode = (nextMode: ToolMode) => {
    if (nextMode === mode) return;
    loadRequestRef.current += 1;
    processRequestRef.current += 1;
    if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url);
    sourceRef.current = null;
    setSource(null);
    setResult(null);
    setMode(nextMode);
    setIsLoading(false);
    setIsProcessing(false);
    setError("");
    setNotice("");
  };

  const setDimension = (dimension: "width" | "height", value: number) => {
    if (!Number.isFinite(value)) return;
    const nextValue = Math.max(1, Math.round(value));
    setCustomDimensions(true);
    if (dimension === "width") {
      setWidth(nextValue);
    } else {
      setHeight(nextValue);
    }
  };

  const applyPreset = (presetId: string) => {
    const preset = IMAGE_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setSelectedPresetId(presetId);
    setCustomDimensions(false);
    setWidth(preset.width);
    setHeight(preset.height);
    setDpi(preset.dpi);
    setCropZoom(1);
    setCropCenter({ x: 0.5, y: 0.5 });
  };

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    const shouldShowCropPreview = mode === "crop" || (mode === "resize" && (selectedPresetId || customDimensions));
    if (!canvas || !source || !shouldShowCropPreview || result) return;

    const drawPreview = () => {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      setPreviewSize((current) =>
        current.width === bounds.width && current.height === bounds.height
          ? current
          : { width: bounds.width, height: bounds.height },
      );
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.round(bounds.width * pixelRatio);
      canvas.height = Math.round(bounds.height * pixelRatio);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.fillStyle = getThemeColor("surface-subtle");
      context.fillRect(0, 0, bounds.width, bounds.height);

      const orientedSize = getOrientedImageSize(source.image, rotation);
      if (mode === "crop") {
        const imageBounds = getContainedImageBounds(
          bounds.width,
          bounds.height,
          orientedSize.width,
          orientedSize.height,
        );
        const imageScale = imageBounds.width / orientedSize.width;
        context.save();
        context.translate(
          imageBounds.x + imageBounds.width / 2,
          imageBounds.y + imageBounds.height / 2,
        );
        context.rotate((rotation * Math.PI) / 180);
        context.scale(
          (flipHorizontal ? -1 : 1) * imageScale,
          (flipVertical ? -1 : 1) * imageScale,
        );
        context.drawImage(
          source.image,
          -source.image.naturalWidth / 2,
          -source.image.naturalHeight / 2,
        );
        context.restore();
        return;
      }

      const frame = getPreviewFrame(bounds.width, bounds.height, width / height);
      const crop = getCoverCrop(
        orientedSize.width,
        orientedSize.height,
        width,
        height,
        cropZoom,
        cropCenter.x,
        cropCenter.y,
      );
      const imageScale = frame.width / crop.width;
      context.save();
      context.translate(
        frame.x - crop.x * imageScale + (orientedSize.width * imageScale) / 2,
        frame.y - crop.y * imageScale + (orientedSize.height * imageScale) / 2,
      );
      context.rotate((rotation * Math.PI) / 180);
      context.scale(
        (flipHorizontal ? -1 : 1) * imageScale,
        (flipVertical ? -1 : 1) * imageScale,
      );
      context.drawImage(
        source.image,
        -source.image.naturalWidth / 2,
        -source.image.naturalHeight / 2,
      );
      context.restore();

      context.fillStyle = getThemeColor("preview", 0.58);
      context.fillRect(0, 0, bounds.width, frame.y);
      context.fillRect(0, frame.y + frame.height, bounds.width, bounds.height - frame.y - frame.height);
      context.fillRect(0, frame.y, frame.x, frame.height);
      context.fillRect(frame.x + frame.width, frame.y, bounds.width - frame.x - frame.width, frame.height);
      context.strokeStyle = getThemeColor("ink-inverse");
      context.lineWidth = 3;
      context.strokeRect(frame.x, frame.y, frame.width, frame.height);
    };

    drawPreview();
    const observer = new ResizeObserver(drawPreview);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [
    source,
    mode,
    selectedPresetId,
    customDimensions,
    result,
    width,
    height,
    cropZoom,
    cropCenter,
    perspectiveCropEnabled,
    rotation,
    flipHorizontal,
    flipVertical,
  ]);

  const updateCropCenter = (x: number, y: number) => {
    if (!source) return;
    const orientedSize = getOrientedImageSize(source.image, rotation);
    const crop = getCoverCrop(
      orientedSize.width,
      orientedSize.height,
      width,
      height,
      cropZoom,
      x,
      y,
    );
    setCropCenter({
      x: (crop.x + crop.width / 2) / orientedSize.width,
      y: (crop.y + crop.height / 2) / orientedSize.height,
    });
  };

  const adjustCropZoom = (change: number, clientX?: number, clientY?: number) => {
    if (!source) return;
    const nextZoom = Math.min(3, Math.max(1, Number((cropZoom + change).toFixed(2))));
    if (clientX !== undefined && clientY !== undefined && previewCanvasRef.current) {
      const bounds = previewCanvasRef.current.getBoundingClientRect();
      const frame = getPreviewFrame(bounds.width, bounds.height, width / height);
      const orientedSize = getOrientedImageSize(source.image, rotation);
      const oldCrop = getCoverCrop(
        orientedSize.width,
        orientedSize.height,
        width,
        height,
        cropZoom,
        cropCenter.x,
        cropCenter.y,
      );
      const newCrop = getCoverCrop(
        orientedSize.width,
        orientedSize.height,
        width,
        height,
        nextZoom,
        cropCenter.x,
        cropCenter.y,
      );
      const anchorX = Math.min(1, Math.max(0, (clientX - bounds.left - frame.x) / frame.width));
      const anchorY = Math.min(1, Math.max(0, (clientY - bounds.top - frame.y) / frame.height));
      const sourceX = oldCrop.x + anchorX * oldCrop.width;
      const sourceY = oldCrop.y + anchorY * oldCrop.height;
      setCropCenter({
        x: (sourceX - anchorX * newCrop.width + newCrop.width / 2) / orientedSize.width,
        y: (sourceY - anchorY * newCrop.height + newCrop.height / 2) / orientedSize.height,
      });
    }
    setCropZoom(nextZoom);
  };

  const startPerspectiveDrag = (
    event: ReactPointerEvent<SVGElement>,
    target: CropDragTarget,
  ) => {
    if (!perspectiveCropPoints || !perspectiveOverlayRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    perspectiveOverlayRef.current.setPointerCapture(event.pointerId);
    perspectiveDragRef.current = {
      pointerId: event.pointerId,
      target,
      startX: event.clientX,
      startY: event.clientY,
      initialPoints: perspectiveCropPoints,
    };
  };

  const movePerspectiveCrop = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = perspectiveDragRef.current;
    const canvas = previewCanvasRef.current;
    const overlay = perspectiveOverlayRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !canvas || !overlay || !source) return;
    const bounds = overlay.getBoundingClientRect();
    const canvasBounds = canvas.getBoundingClientRect();
    const orientedSize = getOrientedImageSize(source.image, rotation);
    const imageBounds = getContainedImageBounds(
      canvasBounds.width,
      canvasBounds.height,
      orientedSize.width,
      orientedSize.height,
    );
    if (!imageBounds.width || !imageBounds.height) return;

    const deltaX = (event.clientX - drag.startX) / imageBounds.width;
    const deltaY = (event.clientY - drag.startY) / imageBounds.height;
    if ("point" in drag.target) {
      const { point } = drag.target;
      if (!perspectiveCropEnabled) {
        const nextX = Math.min(1, Math.max(0, drag.initialPoints[point].x + deltaX));
        const nextY = Math.min(1, Math.max(0, drag.initialPoints[point].y + deltaY));
        setPerspectiveCropPoints(moveRectCropCorner(
          drag.initialPoints,
          point,
          nextX,
          nextY,
          1 / orientedSize.width,
          1 / orientedSize.height,
        ));
        return;
      }
      setPerspectiveCropPoints({
        ...drag.initialPoints,
        [point]: {
          x: Math.min(1, Math.max(0, drag.initialPoints[point].x + deltaX)),
          y: Math.min(1, Math.max(0, drag.initialPoints[point].y + deltaY)),
        },
      });
      return;
    }

    if ("edge" in drag.target) {
      const [first, second] = getCropEdgePoints(drag.target.edge);
      if (!perspectiveCropEnabled) {
        const nextPoints = { ...drag.initialPoints };
        const horizontalEdge = drag.target.edge === "top" || drag.target.edge === "bottom";
        const delta = horizontalEdge ? deltaY : deltaX;
        const minimum = horizontalEdge ? 1 / orientedSize.height : 1 / orientedSize.width;
        const start = horizontalEdge
          ? drag.initialPoints.tl.y
          : drag.initialPoints.tl.x;
        const end = horizontalEdge
          ? drag.initialPoints.bl.y
          : drag.initialPoints.tr.x;
        const movement = drag.target.edge === "top" || drag.target.edge === "left"
          ? Math.max(-start, Math.min(end - start - minimum, delta))
          : Math.max(-(end - start - minimum), Math.min(1 - end, delta));
        if (drag.target.edge === "top") {
          nextPoints.tl = { ...nextPoints.tl, y: start + movement };
          nextPoints.tr = { ...nextPoints.tr, y: nextPoints.tl.y };
        } else if (drag.target.edge === "bottom") {
          nextPoints.bl = { ...nextPoints.bl, y: end + movement };
          nextPoints.br = { ...nextPoints.br, y: nextPoints.bl.y };
        } else if (drag.target.edge === "left") {
          nextPoints.tl = { ...nextPoints.tl, x: start + movement };
          nextPoints.bl = { ...nextPoints.bl, x: nextPoints.tl.x };
        } else {
          nextPoints.tr = { ...nextPoints.tr, x: end + movement };
          nextPoints.br = { ...nextPoints.br, x: nextPoints.tr.x };
        }
        setPerspectiveCropPoints(nextPoints);
        return;
      }
      const edgeX = (drag.initialPoints[second].x - drag.initialPoints[first].x) * imageBounds.width;
      const edgeY = (drag.initialPoints[second].y - drag.initialPoints[first].y) * imageBounds.height;
      const edgeLength = Math.hypot(edgeX, edgeY) || 1;
      const normalX = -edgeY / edgeLength;
      const normalY = edgeX / edgeLength;
      const movementX = (event.clientX - drag.startX) * canvasBounds.width / bounds.width;
      const movementY = (event.clientY - drag.startY) * canvasBounds.height / bounds.height;
      let distance = movementX * normalX + movementY * normalY;

      for (const point of [first, second]) {
        const x = drag.initialPoints[point].x * imageBounds.width;
        const y = drag.initialPoints[point].y * imageBounds.height;
        if (normalX > 0) {
          distance = Math.max(distance, -x / normalX);
          distance = Math.min(distance, (imageBounds.width - x) / normalX);
        } else if (normalX < 0) {
          distance = Math.max(distance, (imageBounds.width - x) / normalX);
          distance = Math.min(distance, -x / normalX);
        }
        if (normalY > 0) {
          distance = Math.max(distance, -y / normalY);
          distance = Math.min(distance, (imageBounds.height - y) / normalY);
        } else if (normalY < 0) {
          distance = Math.max(distance, (imageBounds.height - y) / normalY);
          distance = Math.min(distance, -y / normalY);
        }
      }

      const nextPoints = { ...drag.initialPoints };
      for (const point of [first, second]) {
        nextPoints[point] = {
          x: drag.initialPoints[point].x + normalX * distance / imageBounds.width,
          y: drag.initialPoints[point].y + normalY * distance / imageBounds.height,
        };
      }
      setPerspectiveCropPoints(nextPoints);
      return;
    }

    const points = Object.values(drag.initialPoints);
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const boundedX = Math.max(-minX, Math.min(1 - maxX, deltaX));
    const boundedY = Math.max(-minY, Math.min(1 - maxY, deltaY));
    setPerspectiveCropPoints({
      tl: { x: drag.initialPoints.tl.x + boundedX, y: drag.initialPoints.tl.y + boundedY },
      tr: { x: drag.initialPoints.tr.x + boundedX, y: drag.initialPoints.tr.y + boundedY },
      br: { x: drag.initialPoints.br.x + boundedX, y: drag.initialPoints.br.y + boundedY },
      bl: { x: drag.initialPoints.bl.x + boundedX, y: drag.initialPoints.bl.y + boundedY },
    });
  };

  const finishPerspectiveDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (perspectiveDragRef.current?.pointerId !== event.pointerId) return;
    perspectiveDragRef.current = null;
    if (perspectiveOverlayRef.current?.hasPointerCapture(event.pointerId)) {
      perspectiveOverlayRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const processImage = async () => {
    if (!source) return;
    const requestId = ++processRequestRef.current;
    setError("");
    setNotice("");
    setIsProcessing(true);
    try {
      let outputWidth: number;
      let outputHeight: number;
      let canvas: HTMLCanvasElement;
      const orientedSize = getOrientedImageSize(source.image, rotation);
      if (mode === "crop" && perspectiveCropEnabled) {
        if (!perspectiveCropPoints || !isValidQuad(perspectiveCropPoints)) {
          throw new Error("Move the crop points so they form a convex shape.");
        }
        const outputSize = getPerspectiveCropSize(
          perspectiveCropPoints,
          orientedSize.width,
          orientedSize.height,
        );
        outputWidth = outputSize.width;
        outputHeight = outputSize.height;
        validateOutputDimensions(outputWidth, outputHeight);

        const sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = orientedSize.width;
        sourceCanvas.height = orientedSize.height;
        const sourceContext = sourceCanvas.getContext("2d");
        if (!sourceContext) throw new Error("Image processing is unavailable.");
        if (format === "image/jpeg") {
          sourceContext.fillStyle = getThemeColor("image-output-background");
          sourceContext.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
        }
        sourceContext.translate(sourceCanvas.width / 2, sourceCanvas.height / 2);
        sourceContext.rotate((rotation * Math.PI) / 180);
        sourceContext.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
        sourceContext.drawImage(
          source.image,
          -source.image.naturalWidth / 2,
          -source.image.naturalHeight / 2,
        );

        const sourceQuad: Quad = {
          tl: { x: perspectiveCropPoints.tl.x * sourceCanvas.width, y: perspectiveCropPoints.tl.y * sourceCanvas.height },
          tr: { x: perspectiveCropPoints.tr.x * sourceCanvas.width, y: perspectiveCropPoints.tr.y * sourceCanvas.height },
          br: { x: perspectiveCropPoints.br.x * sourceCanvas.width, y: perspectiveCropPoints.br.y * sourceCanvas.height },
          bl: { x: perspectiveCropPoints.bl.x * sourceCanvas.width, y: perspectiveCropPoints.bl.y * sourceCanvas.height },
        };
        canvas = applyPerspectiveTransform(sourceCanvas, sourceQuad, outputWidth, outputHeight);
      } else if (mode === "crop") {
        if (!perspectiveCropPoints) throw new Error("The crop frame is unavailable.");
        const left = Math.min(perspectiveCropPoints.tl.x, perspectiveCropPoints.bl.x);
        const right = Math.max(perspectiveCropPoints.tr.x, perspectiveCropPoints.br.x);
        const top = Math.min(perspectiveCropPoints.tl.y, perspectiveCropPoints.tr.y);
        const bottom = Math.max(perspectiveCropPoints.bl.y, perspectiveCropPoints.br.y);
        outputWidth = Math.max(1, Math.round((right - left) * orientedSize.width));
        outputHeight = Math.max(1, Math.round((bottom - top) * orientedSize.height));
        validateOutputDimensions(outputWidth, outputHeight);
        canvas = document.createElement("canvas");
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Image processing is unavailable.");
        if (format === "image/jpeg") {
          context.fillStyle = getThemeColor("image-output-background");
          context.fillRect(0, 0, outputWidth, outputHeight);
        }
        const sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = orientedSize.width;
        sourceCanvas.height = orientedSize.height;
        const sourceContext = sourceCanvas.getContext("2d");
        if (!sourceContext) throw new Error("Image processing is unavailable.");
        sourceContext.translate(sourceCanvas.width / 2, sourceCanvas.height / 2);
        sourceContext.rotate((rotation * Math.PI) / 180);
        sourceContext.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
        sourceContext.drawImage(
          source.image,
          -source.image.naturalWidth / 2,
          -source.image.naturalHeight / 2,
        );
        context.drawImage(
          sourceCanvas,
          left * sourceCanvas.width,
          top * sourceCanvas.height,
          (right - left) * sourceCanvas.width,
          (bottom - top) * sourceCanvas.height,
          0,
          0,
          outputWidth,
          outputHeight,
        );
      } else {
        outputWidth = width;
        outputHeight = height;
        validateOutputDimensions(outputWidth, outputHeight);
        canvas = document.createElement("canvas");
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Image processing is unavailable.");
        if (format === "image/jpeg") {
          context.fillStyle = getThemeColor("image-output-background");
          context.fillRect(0, 0, outputWidth, outputHeight);
        }

        const crop = getCoverCrop(
          orientedSize.width,
          orientedSize.height,
          outputWidth,
          outputHeight,
          cropZoom,
          cropCenter.x,
          cropCenter.y,
        );
        context.save();
        context.scale(outputWidth / crop.width, outputHeight / crop.height);
        context.translate(-crop.x, -crop.y);
        context.translate(orientedSize.width / 2, orientedSize.height / 2);
        context.rotate((rotation * Math.PI) / 180);
        context.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
        context.drawImage(
          source.image,
          -source.image.naturalWidth / 2,
          -source.image.naturalHeight / 2,
        );
        context.restore();
      }

      let blob: Blob;
      let finalWidth = canvas.width;
      let finalHeight = canvas.height;
      if (mode === "compress") {
        if (compressionMode === "target") {
          const compressed = await encodeToTargetSize(
            canvas,
            format,
            DEFAULT_QUALITY,
            targetKB * 1024,
          );
          if (requestId !== processRequestRef.current) return;
          blob = compressed.blob;
          finalWidth = compressed.width;
          finalHeight = compressed.height;
          if (blob.size > targetKB * 1024) {
            setNotice("The closest result is still above your target size. Try a larger target.");
          }
        } else {
          blob = await canvasToBlob(canvas, format, quality);
        }
      } else {
        blob = await canvasToBlob(canvas, format, quality);
      }

      if (requestId !== processRequestRef.current) return;
      const url = URL.createObjectURL(blob);
      setResult({ blob, url, width: finalWidth, height: finalHeight, format });
    } catch (processError) {
      if (requestId !== processRequestRef.current) return;
      console.error("Unable to process image", processError);
      setError(processError instanceof Error ? processError.message : "The image could not be processed.");
    } finally {
      if (requestId === processRequestRef.current) setIsProcessing(false);
    }
  };

  const downloadResult = () => {
    if (!source || !result) return;
    const link = document.createElement("a");
    link.href = result.url;
    link.download = `${baseName(source.file.name)}-${mode}.${getImageExtension(result.format)}`;
    link.click();
    setDownloadToast(true);
  };

  const tabs: Array<{ id: ToolMode; label: string; caption: string; icon: LucideIcon }> = [
    { id: "resize", label: "Resize", caption: "Dimensions & DPI", icon: Scaling },
    { id: "crop", label: "Crop", caption: "Frame the image", icon: Crop },
    { id: "compress", label: "Compress", caption: "KB & quality", icon: FileArchive },
    { id: "convert", label: "Convert", caption: "Image formats", icon: RefreshCw },
  ];

  const presetOptions = [
    { value: "", label: "Select a preset", disabled: true },
    ...[
      { id: "universal", label: "Universal" },
      { id: "identity", label: "Identity & Document Portals" },
      { id: "government", label: "Popular Central & State Government Exams" },
    ].flatMap((group) => [
      {
        value: `group-${group.id}`,
        label: group.label,
        disabled: true,
        groupHeader: true,
      },
      ...IMAGE_PRESETS
        .filter((preset) => preset.group === group.id)
        .map((preset) => ({ value: preset.id, label: preset.label })),
    ]),
  ];
  const orientedSize = source ? getOrientedImageSize(source.image, rotation) : null;
  const perspectiveImageBounds = orientedSize && previewSize.width && previewSize.height
    ? getContainedImageBounds(
        previewSize.width,
        previewSize.height,
        orientedSize.width,
        orientedSize.height,
      )
    : null;
  const perspectiveScreenPoints = perspectiveCropPoints && perspectiveImageBounds
    ? {
        tl: {
          x: perspectiveImageBounds.x + perspectiveCropPoints.tl.x * perspectiveImageBounds.width,
          y: perspectiveImageBounds.y + perspectiveCropPoints.tl.y * perspectiveImageBounds.height,
        },
        tr: {
          x: perspectiveImageBounds.x + perspectiveCropPoints.tr.x * perspectiveImageBounds.width,
          y: perspectiveImageBounds.y + perspectiveCropPoints.tr.y * perspectiveImageBounds.height,
        },
        br: {
          x: perspectiveImageBounds.x + perspectiveCropPoints.br.x * perspectiveImageBounds.width,
          y: perspectiveImageBounds.y + perspectiveCropPoints.br.y * perspectiveImageBounds.height,
        },
        bl: {
          x: perspectiveImageBounds.x + perspectiveCropPoints.bl.x * perspectiveImageBounds.width,
          y: perspectiveImageBounds.y + perspectiveCropPoints.bl.y * perspectiveImageBounds.height,
        },
      }
    : null;
  return (
    <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-muted">
      {downloadToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-preview px-4 py-2.5 text-sm font-medium text-ink-inverse shadow-lg"
        >
          Download complete
        </div>
      )}
      <header className="flex shrink-0 items-center px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
          <BackToToolsButton onClick={onClose} toolName="Image Tools" />
        </div>
      </header>

      <div className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-cols-1 auto-rows-max gap-4 overflow-y-auto p-4 sm:px-6 sm:py-5 min-[900px]:auto-rows-fr min-[900px]:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] min-[900px]:overflow-hidden">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-ui bg-surface shadow-sm">
            <div className="grid shrink-0 grid-cols-4 border-b border-ui-subtle p-1.5">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={mode === tab.id}
                  onClick={() => selectMode(tab.id)}
                  className={`rounded-xl px-2 py-1.5 text-center transition-colors ${mode === tab.id ? "bg-action-subtle text-action-hover" : "text-ink-secondary hover:bg-surface-muted"}`}
                >
                  <tab.icon className="mx-auto mb-1 h-3.5 w-3.5" aria-hidden="true" />
                  <span className="block text-sm font-bold">{tab.label}</span>
                  <span className="mt-0.5 block text-[11px] text-ink-muted">{tab.caption}</span>
                </button>
              ))}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5 min-[900px]:overflow-hidden">
              {!source ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    void loadFile(event.dataTransfer.files[0]);
                  }}
                  className="flex min-h-64 flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ui-strong bg-surface-muted px-5 text-center transition-colors hover:border-action-outline hover:bg-action-subtle/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-emphasis"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-action shadow-sm">
                    <ImagePlus className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <span className="mt-4 text-base font-bold text-ink-primary">{UPLOAD_COPY[mode]}</span>
                  <span className="mt-1 text-sm text-ink-muted">Drop or browse to upload</span>
                  <span className="mt-3 rounded-full bg-surface px-3 py-1 text-xs text-ink-muted">JPG · PNG · WebP · up to 50 MB</span>
                </button>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-muted p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-action">
                        <FileImage className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <span className="min-w-0">
                        <span className="block max-w-[16rem] truncate text-sm font-semibold text-ink-primary">{source.file.name}</span>
                        <span className="text-xs text-ink-muted">{source.image.naturalWidth} × {source.image.naturalHeight} px · {formatFileSize(source.file.size)}</span>
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-ui bg-surface px-3 py-2 text-xs font-semibold text-ink-strong hover:bg-surface-muted">Replace</button>
                      <button type="button" onClick={() => { if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url); sourceRef.current = null; setSource(null); setResult(null); setError(""); setNotice(""); }} className="rounded-lg px-3 py-2 text-xs font-semibold text-ink-muted hover:bg-surface hover:text-ink-primary">Remove</button>
                    </div>
                  </div>

                  <div className="relative grid min-h-64 min-w-0 flex-1 place-items-center overflow-hidden rounded-xl bg-surface-subtle p-3">
                    {isLoading ? (
                      <LoaderCircle className="h-7 w-7 animate-spin text-action-emphasis" aria-label="Opening image" />
                    ) : !result && (mode === "crop" || (mode === "resize" && (selectedPresetId || customDimensions))) ? (
                      <>
                        <canvas
                          ref={previewCanvasRef}
                          aria-label={`Crop preview, ${width} by ${height} pixels. Drag the image to reposition, scroll to zoom.`}
                          tabIndex={0}
                          className="h-full min-h-0 w-full min-w-0 touch-none cursor-grab active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-action-emphasis"
                          onPointerDown={(event) => {
                            if (mode === "crop") return;
                            cropDragRef.current = {
                              pointerId: event.pointerId,
                              x: event.clientX,
                              y: event.clientY,
                            };
                            event.currentTarget.setPointerCapture(event.pointerId);
                          }}
                          onPointerMove={(event) => {
                            if (mode === "crop") return;
                            const drag = cropDragRef.current;
                            if (!drag || drag.pointerId !== event.pointerId) return;
                            const bounds = event.currentTarget.getBoundingClientRect();
                            const orientedSize = getOrientedImageSize(source.image, rotation);
                            const frame = getPreviewFrame(
                              bounds.width,
                              bounds.height,
                              width / height,
                            );
                            const crop = getCoverCrop(
                              orientedSize.width,
                              orientedSize.height,
                              width,
                              height,
                              cropZoom,
                              cropCenter.x,
                              cropCenter.y,
                            );
                            const imageScale = frame.width / crop.width;
                            const imageWidth = orientedSize.width * imageScale;
                            const imageHeight = orientedSize.height * imageScale;
                            updateCropCenter(
                              cropCenter.x - (event.clientX - drag.x) / imageWidth,
                              cropCenter.y - (event.clientY - drag.y) / imageHeight,
                            );
                            cropDragRef.current = {
                              pointerId: event.pointerId,
                              x: event.clientX,
                              y: event.clientY,
                            };
                          }}
                          onPointerUp={(event) => {
                            cropDragRef.current = null;
                            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                              event.currentTarget.releasePointerCapture(event.pointerId);
                            }
                          }}
                          onPointerCancel={() => { cropDragRef.current = null; }}
                          onWheel={(event) => {
                            if (mode === "crop") return;
                            event.preventDefault();
                            adjustCropZoom(event.deltaY < 0 ? 0.1 : -0.1, event.clientX, event.clientY);
                          }}
                          onKeyDown={(event) => {
                            if (mode === "crop") return;
                            const movement = 0.01;
                            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                              event.preventDefault();
                              updateCropCenter(
                                cropCenter.x + (event.key === "ArrowLeft" ? -movement : movement),
                                cropCenter.y,
                              );
                            } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                              event.preventDefault();
                              updateCropCenter(
                                cropCenter.x,
                                cropCenter.y + (event.key === "ArrowUp" ? -movement : movement),
                              );
                            } else if (event.key === "+" || event.key === "=") {
                              event.preventDefault();
                              adjustCropZoom(0.1);
                            } else if (event.key === "-") {
                              event.preventDefault();
                              adjustCropZoom(-0.1);
                            }
                          }}
                        />
                        {mode === "crop" && perspectiveCropPoints && perspectiveScreenPoints && (
                          <svg
                            ref={perspectiveOverlayRef}
                            className="pointer-events-none absolute inset-0 h-full w-full touch-none"
                            viewBox={`0 0 ${previewSize.width} ${previewSize.height}`}
                            preserveAspectRatio="none"
                            role="group"
                            aria-label="Perspective crop frame"
                            onPointerMove={movePerspectiveCrop}
                            onPointerUp={finishPerspectiveDrag}
                            onPointerCancel={finishPerspectiveDrag}
                          >
                            <defs>
                              <mask id="image-tools-perspective-crop-mask">
                                <rect width={previewSize.width} height={previewSize.height} fill="white" />
                                <polygon
                                  points={`${perspectiveScreenPoints.tl.x},${perspectiveScreenPoints.tl.y} ${perspectiveScreenPoints.tr.x},${perspectiveScreenPoints.tr.y} ${perspectiveScreenPoints.br.x},${perspectiveScreenPoints.br.y} ${perspectiveScreenPoints.bl.x},${perspectiveScreenPoints.bl.y}`}
                                  fill="black"
                                />
                              </mask>
                            </defs>
                            <rect
                              width={previewSize.width}
                              height={previewSize.height}
                              fill="color-mix(in srgb, var(--theme-preview) 55%, transparent)"
                              mask="url(#image-tools-perspective-crop-mask)"
                            />
                            <polygon
                              points={`${perspectiveScreenPoints.tl.x},${perspectiveScreenPoints.tl.y} ${perspectiveScreenPoints.tr.x},${perspectiveScreenPoints.tr.y} ${perspectiveScreenPoints.br.x},${perspectiveScreenPoints.br.y} ${perspectiveScreenPoints.bl.x},${perspectiveScreenPoints.bl.y}`}
                              fill="transparent"
                              stroke="var(--theme-action-accent)"
                              strokeWidth="2"
                              strokeLinejoin="round"
                              pointerEvents="all"
                              className="pointer-events-auto cursor-move"
                              aria-label="Move crop area"
                              onPointerDown={(event) => startPerspectiveDrag(event, { whole: true })}
                            />
                            {(["top", "right", "bottom", "left"] as CropEdge[]).map((edge) => {
                              const midpoint = getCropEdgeMidpoint(perspectiveScreenPoints, edge);
                              const angle = getCropEdgeAngle(perspectiveScreenPoints, edge);
                              return (
                                <g
                                  key={edge}
                                  role="button"
                                  tabIndex={0}
                                  aria-label={`Move ${edge} crop edge`}
                                  className={`pointer-events-auto outline-none ${edge === "top" || edge === "bottom" ? "cursor-ns-resize" : "cursor-ew-resize"}`}
                                  transform={`translate(${midpoint.x} ${midpoint.y}) rotate(${angle})`}
                                  onPointerDown={(event) => startPerspectiveDrag(event, { edge })}
                                  onKeyDown={(event) => {
                                    const movement = event.shiftKey ? 0.02 : 0.005;
                                    const deltas: Record<string, [number, number]> = {
                                      ArrowLeft: [-movement, 0],
                                      ArrowRight: [movement, 0],
                                      ArrowUp: [0, -movement],
                                      ArrowDown: [0, movement],
                                    };
                                    const delta = deltas[event.key];
                                    if (!delta || !perspectiveCropPoints) return;
                                    event.preventDefault();
                                    const [first, second] = getCropEdgePoints(edge);
                                    const points = [first, second];
                                    const maxDeltaX = Math.min(...points.map((point) =>
                                      delta[0] < 0
                                        ? perspectiveCropPoints[point].x
                                        : 1 - perspectiveCropPoints[point].x,
                                    ));
                                    const maxDeltaY = Math.min(...points.map((point) =>
                                      delta[1] < 0
                                        ? perspectiveCropPoints[point].y
                                        : 1 - perspectiveCropPoints[point].y,
                                    ));
                                    const x = Math.sign(delta[0]) * Math.min(Math.abs(delta[0]), maxDeltaX);
                                    const y = Math.sign(delta[1]) * Math.min(Math.abs(delta[1]), maxDeltaY);
                                    setPerspectiveCropPoints({
                                      ...perspectiveCropPoints,
                                      [first]: { x: perspectiveCropPoints[first].x + x, y: perspectiveCropPoints[first].y + y },
                                      [second]: { x: perspectiveCropPoints[second].x + x, y: perspectiveCropPoints[second].y + y },
                                    });
                                  }}
                                >
                                  <rect
                                    x="-14"
                                    y="-3"
                                    width="28"
                                    height="6"
                                    rx="3"
                                    fill="white"
                                    stroke="var(--theme-action)"
                                    strokeWidth="1.5"
                                    pointerEvents="all"
                                  />
                                </g>
                              );
                            })}
                            {([
                              ["tl", "Top left", perspectiveScreenPoints.tl],
                              ["tr", "Top right", perspectiveScreenPoints.tr],
                              ["br", "Bottom right", perspectiveScreenPoints.br],
                              ["bl", "Bottom left", perspectiveScreenPoints.bl],
                            ] as const).map(([key, label, point]) => (
                              <g
                                key={key}
                                role="button"
                                tabIndex={0}
                                aria-label={`${label} crop point`}
                                className={`pointer-events-auto outline-none ${key === "tl" || key === "br" ? "cursor-nwse-resize" : "cursor-nesw-resize"}`}
                                onPointerDown={(event) => startPerspectiveDrag(event, { point: key })}
                                onKeyDown={(event) => {
                                  const movement = event.shiftKey ? 0.02 : 0.005;
                                  const deltas: Record<string, [number, number]> = {
                                    ArrowLeft: [-movement, 0],
                                    ArrowRight: [movement, 0],
                                    ArrowUp: [0, -movement],
                                    ArrowDown: [0, movement],
                                  };
                                  const delta = deltas[event.key];
                                  if (!delta || !perspectiveCropPoints) return;
                                  event.preventDefault();
                                  if (!perspectiveCropEnabled && orientedSize) {
                                    setPerspectiveCropPoints(moveRectCropCorner(
                                      perspectiveCropPoints,
                                      key,
                                      Math.min(1, Math.max(0, perspectiveCropPoints[key].x + delta[0])),
                                      Math.min(1, Math.max(0, perspectiveCropPoints[key].y + delta[1])),
                                      1 / orientedSize.width,
                                      1 / orientedSize.height,
                                    ));
                                    return;
                                  }
                                  setPerspectiveCropPoints({
                                    ...perspectiveCropPoints,
                                    [key]: {
                                      x: Math.min(1, Math.max(0, perspectiveCropPoints[key].x + delta[0])),
                                      y: Math.min(1, Math.max(0, perspectiveCropPoints[key].y + delta[1])),
                                    },
                                  });
                                }}
                              >
                                <circle
                                  cx={point.x}
                                  cy={point.y}
                                  r="8"
                                  fill="white"
                                  stroke="var(--theme-action)"
                                  strokeWidth="1.5"
                                />
                              </g>
                            ))}
                          </svg>
                        )}
                        <div className="absolute right-5 top-1/2 flex -translate-y-1/2 flex-col items-center gap-0.5 rounded-lg border border-ui bg-surface/95 p-0.5 shadow-sm">
                          <button
                            type="button"
                            aria-label="Rotate image 90 degrees"
                            title="Rotate 90°"
                            onClick={() => setRotation((current) => (current + 90) % 360)}
                            className="rounded-md p-1 text-ink-secondary hover:bg-surface-subtle"
                          >
                            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label="Flip image horizontally"
                            title="Flip horizontal"
                            aria-pressed={flipHorizontal}
                            onClick={() => setFlipHorizontal((current) => !current)}
                            className={`rounded-md p-1 hover:bg-surface-subtle ${flipHorizontal ? "bg-action-subtle text-action" : "text-ink-secondary"}`}
                          >
                            <FlipHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label="Flip image vertically"
                            title="Flip vertical"
                            aria-pressed={flipVertical}
                            onClick={() => setFlipVertical((current) => !current)}
                            className={`rounded-md p-1 hover:bg-surface-subtle ${flipVertical ? "bg-action-subtle text-action" : "text-ink-secondary"}`}
                          >
                            <FlipVertical className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          {mode !== "crop" && <span className="my-0.5 h-px w-4 bg-ui" aria-hidden="true" />}
                          {mode !== "crop" && <button
                            type="button"
                            aria-label="Zoom out"
                            title="Zoom out"
                            disabled={cropZoom <= 1}
                            onClick={() => adjustCropZoom(-0.1)}
                            className="rounded-md p-1 text-ink-secondary hover:bg-surface-subtle disabled:text-ink-disabled"
                          >
                            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>}
                          {mode !== "crop" && <span className="min-w-8 text-center text-[11px] font-medium text-ink-secondary">{Math.round(cropZoom * 100)}%</span>}
                          {mode !== "crop" && <button
                            type="button"
                            aria-label="Zoom in"
                            title="Zoom in"
                            disabled={cropZoom >= 3}
                            onClick={() => adjustCropZoom(0.1)}
                            className="rounded-md p-1 text-ink-secondary hover:bg-surface-subtle disabled:text-ink-disabled"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>}
                        </div>
                      </>
                    ) : (
                      <img src={result?.url ?? source.url} alt={result ? "Processed image preview" : "Original image preview"} className="h-full min-h-0 w-full min-w-0 object-contain" />
                    )}
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  void loadFile(event.currentTarget.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
            </div>
          </section>

          <section className="min-h-0 overflow-y-auto rounded-2xl border border-ui bg-surface p-3 shadow-sm sm:p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-sm font-bold text-ink-primary">{mode === "resize" ? "Resize settings" : mode === "crop" ? "Crop settings" : mode === "compress" ? "Compression settings" : "Conversion settings"}</h3>
              <AutoSaveStatusIndicator
                status={autoSave.status}
                lastSavedAt={autoSave.lastSavedAt}
                onRetry={autoSave.retry}
              />
            </div>

            {mode === "resize" && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-ink-secondary">
                  Quick preset
                  <Dropdown
                    aria-label="Quick size preset"
                    value={selectedPresetId}
                    onChange={applyPreset}
                    disabled={customDimensions}
                    className="mt-1.5"
                    options={presetOptions}
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-ink-secondary">
                  <input
                    type="checkbox"
                    checked={customDimensions}
                    onChange={(event) => setCustomDimensions(event.target.checked)}
                    className="accent-action"
                  />
                  Custom dimensions
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-ink-secondary">Width (px)<InputField type="number" min="1" step="1" value={width} disabled={!customDimensions} onChange={(event) => setDimension("width", Number(event.target.value))} className="mt-1.5 w-full" /></label>
                  <label className="text-xs font-semibold text-ink-secondary">Height (px)<InputField type="number" min="1" step="1" value={height} disabled={!customDimensions} onChange={(event) => setDimension("height", Number(event.target.value))} className="mt-1.5 w-full" /></label>
                </div>
                <label className="block text-xs font-semibold text-ink-secondary">DPI<InputField type="number" min="72" max="1200" value={dpi} disabled={!customDimensions} onChange={(event) => setDpi(Math.max(72, Math.min(1200, Number(event.target.value) || 300)))} className="mt-1.5 w-full" /></label>
              </div>
            )}

            {mode === "crop" && (
              <div className="space-y-3 text-sm text-ink-secondary">
                <div className={`flex items-center rounded-xl border p-3 transition-colors ${perspectiveCropEnabled ? "border-action-border-strong bg-action-subtle" : "border-ui bg-surface"}`}>
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={perspectiveCropEnabled}
                      onChange={(event) => {
                        setPerspectiveCropEnabled(event.target.checked);
                        setResult(null);
                      }}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-action"
                    />
                    <span>
                      <span className="block text-xs font-semibold text-ink-primary">Enable perspective crop</span>
                      <span className="mt-1 block text-[11px] leading-4 text-ink-muted">Straighten angled selections with perspective correction.</span>
                    </span>
                  </label>
                  <button
                    type="button"
                    aria-label="Reset crop frame"
                    title="Reset crop frame"
                    onClick={() => setPerspectiveCropPoints({
                      tl: { x: 0.05, y: 0.05 },
                      tr: { x: 0.95, y: 0.05 },
                      br: { x: 0.95, y: 0.95 },
                      bl: { x: 0.05, y: 0.95 },
                    })}
                    className="ml-3 inline-flex h-9 shrink-0 items-center gap-1.5 border-l border-ui pl-3 text-xs font-semibold text-ink-muted transition-colors hover:text-action focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-emphasis"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    Reset
                  </button>
                </div>
                {perspectiveCropEnabled && perspectiveCropPoints && !isValidQuad(perspectiveCropPoints) && (
                  <p role="status" className="text-xs font-medium text-warning">
                    Adjust the handles until they form a convex shape.
                  </p>
                )}
              </div>
            )}

            {mode === "compress" && (
              <div className="space-y-3">
                <div role="radiogroup" aria-label="Compression method" className="grid grid-cols-2 gap-2">
                  <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${compressionMode === "target" ? "border-action bg-action-subtle text-action-hover" : "border-ui text-ink-secondary hover:bg-surface-muted"}`}>
                    <input type="radio" name="compression-mode" value="target" checked={compressionMode === "target"} onChange={() => setCompressionMode("target")} className="accent-action" />
                    Target file size
                  </label>
                  <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${compressionMode === "quality" ? "border-action bg-action-subtle text-action-hover" : "border-ui text-ink-secondary hover:bg-surface-muted"}`}>
                    <input type="radio" name="compression-mode" value="quality" checked={compressionMode === "quality"} onChange={() => setCompressionMode("quality")} className="accent-action" />
                    Quality
                  </label>
                </div>
                {compressionMode === "target" ? (
                  <label className="block text-xs font-semibold text-ink-secondary">Target file size (KB)<InputField type="number" min="1" max="50000" value={targetKB} onChange={(event) => setTargetKB(Math.max(1, Math.min(50000, Number(event.target.value) || 1)))} className="mt-1.5 w-full" /></label>
                ) : (
                  <label className="block text-xs font-semibold text-ink-secondary">Image quality · {quality}%<input type="range" min="10" max="100" step="1" value={quality} onChange={(event) => setQuality(Number(event.target.value))} className="mt-2 w-full accent-action" /></label>
                )}
                {source && (
                  <div aria-live="polite" className="space-y-2 rounded-xl border border-ui bg-surface-muted p-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-ink-secondary">Original size</span>
                      <strong className="text-ink-primary">{formatFileSize(source.file.size)}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-ink-secondary">Compressed size</span>
                      <strong className={result ? "text-success-strong" : "text-ink-faint"}>
                        {result ? formatFileSize(result.blob.size) : isProcessing ? "Compressing…" : "—"}
                      </strong>
                    </div>
                    {result ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ui pt-2 text-xs">
                        <span className="text-ink-secondary">{result.width} × {result.height} px</span>
                        {result.blob.size < source.file.size && (
                          <span className="font-medium text-success">
                            {Math.round((1 - result.blob.size / source.file.size) * 100)}% smaller
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="border-t border-ui pt-2 text-[11px] text-ink-muted">
                        {isProcessing ? "Preparing compressed image…" : "Compress the image to see the result."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {mode === "convert" && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-ink-secondary">Convert to<Dropdown aria-label="Convert to format" value={format} onChange={(value) => setFormat(value as ImageFormat)} className="mt-1.5" options={[{ value: "image/jpeg", label: "JPG · widely compatible" }, { value: "image/png", label: "PNG · transparency / sharp edges" }, { value: "image/webp", label: "WebP · smaller web images" }]} /></label>
              </div>
            )}

            {error && <p role="alert" className="rounded-lg border border-error-soft bg-error-subtle px-3 py-2.5 text-xs leading-5 text-error">{error}</p>}
            {notice && <p role="status" className="rounded-lg border border-warning-soft bg-warning-subtle px-3 py-2.5 text-xs leading-5 text-warning-strong">{notice}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" disabled={!source || isProcessing || isLoading} onClick={() => void processImage()} className={actionButtonClass(!source || isProcessing || isLoading)}>
                {isProcessing ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                {isProcessing ? "Working…" : mode === "resize" ? "Resize image" : mode === "crop" ? "Crop image" : mode === "compress" ? "Compress image" : "Convert image"}
              </button>
              <button type="button" disabled={!result} onClick={downloadResult} className={actionButtonClass(!result)}>
                <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
                Download
              </button>
            </div>
          </section>
      </div>
    </main>
  );
}
