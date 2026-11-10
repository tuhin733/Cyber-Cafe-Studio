import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Brush,
  Check,
  Download,
  Eraser,
  Eye,
  ImagePlus,
  ImageMinus,
  LoaderCircle,
  Palette,
  RefreshCw,
  SquareUserRound,
  Scan,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { ProgressInfo } from "@huggingface/transformers";
import { MAX_BACKGROUND_REMOVAL_PIXELS } from "../lib/backgroundRemoverUtils";
import { useToolAutoSave } from "../hooks/useToolAutoSave";
import { PHOTO_BACKGROUND_COLORS as BACKGROUND_COLORS } from "../theme/theme";
import { notifyUserSuccess } from "../lib/userNotifications";
import AutoSaveStatusIndicator from "./AutoSaveStatusIndicator";
import BackToToolsButton from "./BackToToolsButton";

type BackgroundOption =
  | "transparent"
  | "white"
  | "offwhite"
  | "lightBlue"
  | "skyBlue"
  | "deepSkyBlue"
  | "lightGrey"
  | "veryLightGrey"
  | "lightPink"
  | "cream"
  | "custom";
type LoadedImage = { file: File; url: string; image: HTMLImageElement };
type BrushMode = "erase" | "restore";
interface BackgroundRemoverSession {
  version: 1;
  sourceFile: File | null;
  resultFile: File | null;
  background: BackgroundOption;
  customColor: string;
  isShowingOriginal: boolean;
  previewZoom: number;
}

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_BRUSH_PREVIEW_DIMENSION = 1600;
const MIN_PREVIEW_ZOOM = 0.5;
const MAX_PREVIEW_ZOOM = 3;
const PREVIEW_ZOOM_STEP = 0.25;
const BACKGROUND_PRESETS: Array<{
  id: Exclude<BackgroundOption, "transparent" | "custom">;
  label: string;
}> = [
  { id: "white", label: "White" },
  { id: "offwhite", label: "Off White" },
  { id: "lightBlue", label: "Light Blue" },
  { id: "skyBlue", label: "Sky Blue" },
  { id: "deepSkyBlue", label: "Deep Sky Blue" },
  { id: "lightGrey", label: "Light Grey" },
  { id: "veryLightGrey", label: "Very Light Grey" },
  { id: "lightPink", label: "Light Pink" },
  { id: "cream", label: "Cream" },
];

function getBackgroundColor(option: BackgroundOption, customColor: string) {
  if (option === "custom") return customColor;
  if (option === "transparent") return null;
  return BACKGROUND_COLORS[option];
}

function getBaseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || "photo";
}

function loadImageFile(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ file, url, image });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Unable to restore ${file.name}. The image may be damaged.`));
    };
    image.src = url;
  });
}

interface Props {
  onClose: () => void;
  onSendToPassportMaker: (file: File) => void;
}

export default function PhotoBackgroundRemover({
  onClose,
  onSendToPassportMaker,
}: Props) {
  const [source, setSource] = useState<LoadedImage | null>(null);
  const [result, setResult] = useState<LoadedImage | null>(null);
  const [isShowingOriginal, setIsShowingOriginal] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [isMagicBrushActive, setIsMagicBrushActive] = useState(false);
  const [brushMode, setBrushMode] = useState<BrushMode>("erase");
  const [brushSize, setBrushSize] = useState(36);
  const [brushCursor, setBrushCursor] = useState<{ x: number; y: number } | null>(null);
  const [background, setBackground] = useState<BackgroundOption>("transparent");
  const [customColor, setCustomColor] = useState<string>(BACKGROUND_COLORS.white);
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const isPaintingRef = useRef(false);
  const lastBrushPointRef = useRef<{ x: number; y: number } | null>(null);
  const restoreMaskRef = useRef<HTMLImageElement | null>(null);
  const brushPreviewFrameRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const processIdRef = useRef(0);

  const restoreSession = useCallback(async (saved: BackgroundRemoverSession) => {
    if (
      saved.version !== 1 ||
      (saved.sourceFile !== null && !(saved.sourceFile instanceof File)) ||
      (saved.resultFile !== null && !(saved.resultFile instanceof File))
    ) {
      throw new Error("The saved Background Remover session is invalid.");
    }

    let restoredSource: LoadedImage | null = null;
    let restoredResult: LoadedImage | null = null;
    try {
      if (saved.sourceFile) restoredSource = await loadImageFile(saved.sourceFile);
      if (saved.resultFile) restoredResult = await loadImageFile(saved.resultFile);
    } catch (restoreError) {
      if (restoredSource) URL.revokeObjectURL(restoredSource.url);
      if (restoredResult) URL.revokeObjectURL(restoredResult.url);
      throw restoreError;
    }

    setSource(restoredSource);
    setResult(restoredResult);
    restoreMaskRef.current = restoredResult?.image ?? null;
    setBackground(saved.background);
    setCustomColor(saved.customColor);
    setIsShowingOriginal(saved.isShowingOriginal && restoredResult !== null);
    setPreviewZoom(
      Math.max(MIN_PREVIEW_ZOOM, Math.min(MAX_PREVIEW_ZOOM, saved.previewZoom)),
    );
    setIsMagicBrushActive(false);
  }, []);

  const autosaveSnapshot = useMemo<BackgroundRemoverSession>(() => ({
    version: 1,
    sourceFile: source?.file ?? null,
    resultFile: result?.file ?? null,
    background,
    customColor,
    isShowingOriginal,
    previewZoom,
  }), [
    background,
    customColor,
    isShowingOriginal,
    previewZoom,
    result,
    source,
  ]);
  const autoSave = useToolAutoSave(
    "photo-background-remover",
    autosaveSnapshot,
    restoreSession,
    !isLoadingImage &&
      !isRemovingBackground &&
      !isSavingImage &&
      !isMagicBrushActive,
  );

  useEffect(() => {
    if (!result) {
      editCanvasRef.current = null;
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = result.image.naturalWidth;
    canvas.height = result.image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Image editing is unavailable.");
      return;
    }
    context.drawImage(result.image, 0, 0);
    editCanvasRef.current = canvas;
  }, [result]);

  useEffect(() => {
    const previewCanvas = previewCanvasRef.current;
    const editCanvas = editCanvasRef.current;
    if (!isMagicBrushActive || !previewCanvas || !editCanvas) return;
    const scale = Math.min(
      1,
      MAX_BRUSH_PREVIEW_DIMENSION /
        Math.max(editCanvas.width, editCanvas.height),
    );
    previewCanvas.width = Math.max(1, Math.round(editCanvas.width * scale));
    previewCanvas.height = Math.max(1, Math.round(editCanvas.height * scale));
    previewCanvas
      .getContext("2d")
      ?.drawImage(editCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
  }, [isMagicBrushActive, result, isShowingOriginal]);

  useEffect(() => {
    if (!source) return;
    return () => URL.revokeObjectURL(source.url);
  }, [source]);

  useEffect(() => {
    if (!result) return;
    return () => URL.revokeObjectURL(result.url);
  }, [result]);

  useEffect(() => () => {
    requestIdRef.current += 1;
    processIdRef.current += 1;
    if (brushPreviewFrameRef.current !== null) {
      window.cancelAnimationFrame(brushPreviewFrameRef.current);
    }
  }, []);

  const loadFile = (file?: File) => {
    if (!file) return;
    const requestId = ++requestIdRef.current;
    setIsLoadingImage(false);
    setError("");
    setResult(null);
    restoreMaskRef.current = null;
    setPreviewZoom(1);
    setIsShowingOriginal(false);
    setIsMagicBrushActive(false);

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP photo.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("Choose an image smaller than 20 MB.");
      return;
    }

    setSource(null);
    setIsLoadingImage(true);
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (requestId !== requestIdRef.current) {
        URL.revokeObjectURL(url);
        return;
      }
      setIsLoadingImage(false);
      if (
        image.naturalWidth < 1 ||
        image.naturalHeight < 1 ||
        image.naturalWidth * image.naturalHeight > MAX_BACKGROUND_REMOVAL_PIXELS
      ) {
        URL.revokeObjectURL(url);
        setError(
          `Choose an image under ${MAX_BACKGROUND_REMOVAL_PIXELS.toLocaleString()} pixels.`,
        );
        return;
      }
      setSource({ file, url, image });
      setBackground("transparent");
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      if (requestId === requestIdRef.current) {
        setIsLoadingImage(false);
        setError("This image could not be opened. Try another photo.");
      }
    };
    image.src = url;
  };

  const removeBackground = async () => {
    if (!source) return;
    const processId = ++processIdRef.current;
    setIsRemovingBackground(true);
    setError("");
    setIsShowingOriginal(false);
    setModelProgress(null);
    setPreviewZoom(1);

    try {
      const { removePortraitBackground } = await import(
        "../lib/localBackgroundRemover"
      );
      const { blob } = await removePortraitBackground(source.image, (info: ProgressInfo) => {
        if (processId === processIdRef.current && info.status === "progress_total") {
          setModelProgress(Math.max(0, Math.min(100, Math.round(info.progress))));
        }
      });
      if (processId !== processIdRef.current) return;
      const url = URL.createObjectURL(blob);
      const image = new Image();
      try {
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("The portrait cutout could not be previewed."));
          image.src = url;
        });
        if (
          image.naturalWidth < 1 ||
          image.naturalHeight < 1 ||
          image.naturalWidth * image.naturalHeight > MAX_BACKGROUND_REMOVAL_PIXELS
        ) {
          throw new Error("The portrait cutout exceeds the supported pixel limit.");
        }
      } catch (previewError) {
        URL.revokeObjectURL(url);
        throw previewError;
      }
      if (processId !== processIdRef.current) {
        URL.revokeObjectURL(url);
        return;
      }
      setResult({
        file: new File(
          [blob],
          `${getBaseName(source.file.name)}-no-background.png`,
          { type: "image/png" },
        ),
        url,
        image,
      });
      restoreMaskRef.current = image;
      setIsShowingOriginal(false);
    } catch (processingError) {
      if (processId !== processIdRef.current) return;
      console.error("Unable to remove portrait background locally", processingError);
      setError(
        processingError instanceof Error
          ? processingError.message
          : "The background could not be removed. Check your internet connection and try again.",
      );
    } finally {
      if (processId === processIdRef.current) {
        setIsRemovingBackground(false);
        setModelProgress(null);
      }
    }
  };

  const createFinalImageBlob = async () => {
    if (!result) throw new Error("Remove the background before exporting the photo.");
    const canvas = document.createElement("canvas");
    canvas.width = result.image.naturalWidth;
    canvas.height = result.image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image export is unavailable.");
    const backgroundColor = getBackgroundColor(background, customColor);
    if (backgroundColor) {
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(
      isMagicBrushActive && editCanvasRef.current
        ? editCanvasRef.current
        : result.image,
      0,
      0,
    );
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (output) => {
          if (output) resolve(output);
          else reject(new Error("The portrait cutout could not be exported."));
        },
        "image/png",
      );
    });
  };

  const downloadResult = async () => {
    if (!result || !source) return;
    setIsSavingImage(true);
    setError("");
    try {
      const blob = await createFinalImageBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${getBaseName(source.file.name)}-no-background.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notifyUserSuccess("PNG downloaded.");
    } catch (downloadError) {
      console.error("Unable to export portrait cutout", downloadError);
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "The result could not be downloaded.",
      );
    } finally {
      setIsSavingImage(false);
    }
  };

  const keyboardShortcutsRef = useRef({
    downloadResult,
    isLoadingImage,
    isMagicBrushActive,
    isRemovingBackground,
    isSavingImage,
    removeBackground,
    result,
    source,
  });
  keyboardShortcutsRef.current = {
    downloadResult,
    isLoadingImage,
    isMagicBrushActive,
    isRemovingBackground,
    isSavingImage,
    removeBackground,
    result,
    source,
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.repeat) return;
      const current = keyboardShortcutsRef.current;

      switch (event.key.toLowerCase()) {
        case "o":
          event.preventDefault();
          if (!current.isRemovingBackground && !current.isLoadingImage) {
            fileInputRef.current?.click();
          }
          break;
        case "enter":
          event.preventDefault();
          if (
            current.source &&
            !current.isRemovingBackground &&
            !current.isLoadingImage &&
            !current.isMagicBrushActive
          ) {
            void current.removeBackground();
          }
          break;
        case "s":
          event.preventDefault();
          if (current.result && !current.isSavingImage) void current.downloadResult();
          break;
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const sendToPassportMaker = async () => {
    if (!result || !source) return;
    setIsSavingImage(true);
    setError("");
    try {
      const blob = await createFinalImageBlob();
      onSendToPassportMaker(new File(
        [blob],
        `${getBaseName(source.file.name)}-passport.png`,
        { type: "image/png" },
      ));
    } catch (handoffError) {
      console.error("Unable to prepare cutout for passport printing", handoffError);
      setError(
        handoffError instanceof Error
          ? handoffError.message
          : "The cutout couldn't be sent to the Passport Photo Maker.",
      );
    } finally {
      setIsSavingImage(false);
    }
  };

  const scheduleBrushPreview = () => {
    if (brushPreviewFrameRef.current !== null) return;
    brushPreviewFrameRef.current = window.requestAnimationFrame(() => {
      brushPreviewFrameRef.current = null;
      const editCanvas = editCanvasRef.current;
      const previewCanvas = previewCanvasRef.current;
      if (!editCanvas || !previewCanvas) return;
      const previewContext = previewCanvas.getContext("2d");
      previewContext?.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      previewContext?.drawImage(
        editCanvas,
        0,
        0,
        previewCanvas.width,
        previewCanvas.height,
      );
    });
  };

  const drawBrushSegment = (
    start: { x: number; y: number },
    end: { x: number; y: number },
  ) => {
    const editCanvas = editCanvasRef.current;
    const sourceImage = source?.image;
    if (!editCanvas || !sourceImage) return;
    const context = editCanvas.getContext("2d");
    if (!context) {
      setError("Image editing is unavailable.");
      return;
    }
    const bounds = previewCanvasRef.current?.getBoundingClientRect();
    const scale = bounds ? editCanvas.width / bounds.width : 1;
    const radius = (brushSize * scale) / 2;

    if (brushMode === "erase") {
      context.globalCompositeOperation = "destination-out";
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = radius * 2;
      context.beginPath();
      if (start.x === end.x && start.y === end.y) {
        context.arc(start.x, start.y, radius, 0, Math.PI * 2);
        context.fill();
      } else {
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.stroke();
      }
      context.globalCompositeOperation = "source-over";
    } else {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy) || 1;
      const offsetX = (-dy / length) * radius;
      const offsetY = (dx / length) * radius;
      context.save();
      context.beginPath();
      if (start.x === end.x && start.y === end.y) {
        context.arc(start.x, start.y, radius, 0, Math.PI * 2);
      } else {
        const angle = Math.atan2(dy, dx);
        context.moveTo(start.x + offsetX, start.y + offsetY);
        context.lineTo(end.x + offsetX, end.y + offsetY);
        context.arc(
          end.x,
          end.y,
          radius,
          angle + Math.PI / 2,
          angle - Math.PI / 2,
          true,
        );
        context.lineTo(start.x - offsetX, start.y - offsetY);
        context.arc(
          start.x,
          start.y,
          radius,
          angle - Math.PI / 2,
          angle + Math.PI / 2,
          true,
        );
      }
      context.closePath();
      context.clip();
      context.drawImage(sourceImage, 0, 0);
      context.globalCompositeOperation = "destination-in";
      if (restoreMaskRef.current) {
        context.drawImage(restoreMaskRef.current, 0, 0);
      }
      context.restore();
    }

    scheduleBrushPreview();
  };

  const getBrushPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const editCanvas = editCanvasRef.current;
    return {
      x: (event.clientX - bounds.left) *
        ((editCanvas?.width ?? event.currentTarget.width) / bounds.width),
      y: (event.clientY - bounds.top) *
        ((editCanvas?.height ?? event.currentTarget.height) / bounds.height),
    };
  };

  const applyMagicBrush = async () => {
    const canvas = editCanvasRef.current;
    if (!canvas || !result) return;
    setIsSavingImage(true);
    setError("");
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (output) => {
            if (output) resolve(output);
            else reject(new Error("The brushed cutout could not be saved."));
          },
          "image/png",
        );
      });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      try {
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("The brushed cutout could not be previewed."));
          image.src = url;
        });
      } catch (previewError) {
        URL.revokeObjectURL(url);
        throw previewError;
      }
      setResult({
        file: new File([blob], result.file.name, { type: "image/png" }),
        url,
        image,
      });
      setIsMagicBrushActive(false);
      notifyUserSuccess("Brush edits applied.");
    } catch (brushError) {
      console.error("Unable to apply magic brush edits", brushError);
      setError(
        brushError instanceof Error
          ? brushError.message
          : "The brush edits could not be applied.",
      );
    } finally {
      setIsSavingImage(false);
    }
  };

  const cancelMagicBrush = () => {
    const editCanvas = editCanvasRef.current;
    if (editCanvas && result) {
      editCanvas.getContext("2d")?.drawImage(result.image, 0, 0);
    }
    setIsMagicBrushActive(false);
  };

  const showingResult = result !== null && !isShowingOriginal;
  const previewImage = showingResult ? result : source;
  const previewBackground = showingResult
    ? getBackgroundColor(background, customColor)
    : null;

  return (
    <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-5 sm:px-6">
        <div className="sticky top-0 z-10 -mx-4 -mt-5 mb-5 flex flex-wrap items-center justify-between gap-3 bg-surface-muted/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex items-center gap-3">
            <BackToToolsButton onClick={onClose} toolName="Photo Background Remover" />
          </div>
          <p className="text-[10px] text-ink-muted sm:text-xs">
            Ctrl/Cmd+O upload · Ctrl/Cmd+Enter remove · Ctrl/Cmd+S download
          </p>
        </div>

        <div className="grid flex-1 items-start gap-4 min-[850px]:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.7fr)]">
          <section className="flex min-h-[22rem] flex-col overflow-hidden rounded-2xl border border-ui bg-surface shadow-sm">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={isRemovingBackground || isLoadingImage}
              className="hidden"
              onChange={(event) => {
                loadFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ui-subtle px-4 py-3">
              <div>
                <h3 className="text-sm font-bold text-ink-strong">Preview</h3>
                {source && (
                  <p className="mt-0.5 max-w-[50vw] truncate text-[11px] text-ink-faint">
                    {source.file.name} · {source.image.naturalWidth.toLocaleString()} ×{" "}
                    {source.image.naturalHeight.toLocaleString()} px
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {result && !isShowingOriginal && (
                  isMagicBrushActive ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-action-soft bg-action-subtle/70 p-1.5">
                      <div className="flex rounded-lg bg-surface p-0.5 shadow-sm">
                        <button
                          type="button"
                          aria-pressed={brushMode === "erase"}
                          onClick={() => setBrushMode("erase")}
                          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                            brushMode === "erase"
                              ? "bg-action-emphasis text-ink-inverse"
                              : "text-ink-secondary hover:bg-surface-muted"
                          }`}
                        >
                          <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
                          Erase
                        </button>
                        <button
                          type="button"
                          aria-pressed={brushMode === "restore"}
                          onClick={() => setBrushMode("restore")}
                          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                            brushMode === "restore"
                              ? "bg-action-emphasis text-ink-inverse"
                              : "text-ink-secondary hover:bg-surface-muted"
                          }`}
                          title="Restores original pixels only where the portrait mask is visible."
                        >
                          <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Restore subject
                        </button>
                      </div>
                      <label className="flex items-center gap-2 px-1 text-[11px] font-medium text-ink-secondary">
                        <span>Size</span>
                        <input
                          type="range"
                          aria-label="Brush size"
                          min="12"
                          max="96"
                          step="2"
                          value={brushSize}
                          onChange={(event) => setBrushSize(Number(event.target.value))}
                          className="w-20 accent-action-emphasis"
                        />
                        <span className="w-7 text-right tabular-nums">{brushSize}</span>
                      </label>
                      <button
                        type="button"
                        disabled={isSavingImage}
                        onClick={cancelMagicBrush}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isSavingImage}
                        onClick={() => void applyMagicBrush()}
                        className="rounded-lg bg-action-emphasis px-3 py-1.5 text-xs font-semibold text-ink-inverse shadow-sm transition-colors hover:bg-action disabled:opacity-50"
                      >
                        {isSavingImage ? "Applying…" : "Apply"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setIsMagicBrushActive(true);
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-action-border bg-action-subtle px-3 py-2 text-xs font-semibold text-action shadow-sm transition-colors hover:border-action-border-strong hover:bg-action-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-emphasis"
                    >
                      <Brush className="h-3.5 w-3.5" aria-hidden="true" />
                      Magic Brush
                    </button>
                  )
                )}
                {!isMagicBrushActive && (
                  <button
                    type="button"
                    disabled={isRemovingBackground || isLoadingImage}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-ui bg-surface px-2.5 py-2 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-muted disabled:opacity-50"
                  >
                    {source ? (
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {source ? "Change photo" : "Choose photo"}
                  </button>
                )}
              </div>
            </div>
            <div
              className={`relative min-h-[22rem] flex-1 overflow-hidden sm:min-h-[32rem] ${
                isDragging ? "bg-action-subtle" : "bg-surface-muted"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                if (!isRemovingBackground) setIsDragging(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setIsDragging(false);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                if (!isRemovingBackground) loadFile(event.dataTransfer.files[0]);
              }}
            >
              {previewImage && (
                <div
                  role="group"
                  aria-label="Preview zoom controls"
                  className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-lg border border-ui bg-surface/95 p-1 shadow-sm backdrop-blur"
                >
                  <button
                    type="button"
                    disabled={previewZoom <= MIN_PREVIEW_ZOOM}
                    onClick={() =>
                      setPreviewZoom((zoom) =>
                        Math.max(MIN_PREVIEW_ZOOM, zoom - PREVIEW_ZOOM_STEP),
                      )
                    }
                    aria-label="Zoom out"
                    title="Zoom out"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(1)}
                    aria-label="Reset zoom"
                    title="Reset zoom"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-subtle"
                  >
                    <Scan className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={previewZoom >= MAX_PREVIEW_ZOOM}
                    onClick={() =>
                      setPreviewZoom((zoom) =>
                        Math.min(MAX_PREVIEW_ZOOM, zoom + PREVIEW_ZOOM_STEP),
                      )
                    }
                    aria-label="Zoom in"
                    title="Zoom in"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}
              {source && result && !isMagicBrushActive && (
                <div
                  role="group"
                  aria-label="Compare original and result"
                  className="absolute left-3 top-3 z-20 flex rounded-lg border border-ui bg-surface/95 p-1 shadow-sm backdrop-blur"
                >
                  <button
                    type="button"
                    aria-pressed={isShowingOriginal}
                    onClick={() => setIsShowingOriginal(true)}
                    aria-label="Before: show original photo"
                    title="Before: show original photo"
                    className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                      isShowingOriginal
                        ? "bg-action-emphasis text-ink-inverse"
                        : "text-ink-secondary hover:bg-surface-muted"
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-pressed={!isShowingOriginal}
                    onClick={() => setIsShowingOriginal(false)}
                    aria-label="After: show background-removed photo"
                    title="After: show background-removed photo"
                    className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                      !isShowingOriginal
                        ? "bg-action-emphasis text-ink-inverse"
                        : "text-ink-secondary hover:bg-surface-muted"
                    }`}
                  >
                    <ImageMinus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}
              <div
                className={`absolute inset-0 p-4 ${
                  previewZoom > 1 ? "overflow-auto" : "overflow-hidden"
                }`}
              >
                <div className="flex min-h-full min-w-full items-center justify-center">
                  {isLoadingImage ? (
                    <p className="text-sm font-medium text-ink-muted">Opening photo…</p>
                  ) : previewImage ? (
                    <div className="flex max-h-full max-w-full flex-col items-center gap-2">
                  <div
                    className={`relative inline-flex max-h-full max-w-full items-center justify-center overflow-hidden rounded-lg shadow-sm ${
                      isMagicBrushActive ? "cursor-none" : ""
                    }`}
                    style={{
                      zoom: previewZoom,
                      backgroundColor: previewBackground ?? undefined,
                      backgroundImage: previewBackground
                        ? undefined
                        : "conic-gradient(var(--theme-checker-dark) 25%, var(--theme-checker-light) 0 50%, var(--theme-checker-dark) 0 75%, var(--theme-checker-light) 0)",
                      backgroundSize: previewBackground ? undefined : "20px 20px",
                    }}
                  >
                    {showingResult && isMagicBrushActive ? (
                      <canvas
                        ref={previewCanvasRef}
                        aria-label="Magic Brush editing canvas. Drag to erase or restore parts of the portrait."
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.currentTarget.setPointerCapture(event.pointerId);
                          isPaintingRef.current = true;
                          const bounds = event.currentTarget.getBoundingClientRect();
                          setBrushCursor({
                            x: (event.clientX - bounds.left) / previewZoom,
                            y: (event.clientY - bounds.top) / previewZoom,
                          });
                          const point = getBrushPoint(event);
                          lastBrushPointRef.current = point;
                          drawBrushSegment(point, point);
                        }}
                        onPointerMove={(event) => {
                          const bounds = event.currentTarget.getBoundingClientRect();
                          setBrushCursor({
                            x: (event.clientX - bounds.left) / previewZoom,
                            y: (event.clientY - bounds.top) / previewZoom,
                          });
                          if (!isPaintingRef.current) return;
                          const point = getBrushPoint(event);
                          const previousPoint = lastBrushPointRef.current ?? point;
                          drawBrushSegment(previousPoint, point);
                          lastBrushPointRef.current = point;
                        }}
                        onPointerUp={(event) => {
                          isPaintingRef.current = false;
                          lastBrushPointRef.current = null;
                          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                            event.currentTarget.releasePointerCapture(event.pointerId);
                          }
                        }}
                        onPointerLeave={() => {
                          if (!isPaintingRef.current) setBrushCursor(null);
                        }}
                        onPointerCancel={() => {
                          isPaintingRef.current = false;
                          lastBrushPointRef.current = null;
                          setBrushCursor(null);
                        }}
                        className="block max-h-[58vh] max-w-full touch-none object-contain"
                      />
                    ) : (
                      <img
                        src={previewImage.url}
                        alt={showingResult ? "Portrait with background removed" : "Original portrait"}
                        draggable={false}
                        className="block max-h-[58vh] max-w-full object-contain"
                      />
                    )}
                    {showingResult && isMagicBrushActive && brushCursor && (
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute rounded-full border-2 ring-1 ring-ink-primary/80 ${
                          brushMode === "erase"
                            ? "border-ink-inverse"
                            : "border-action-border-strong"
                        }`}
                        style={{
                          left: brushCursor.x,
                          top: brushCursor.y,
                          width: brushSize / previewZoom,
                          height: brushSize / previewZoom,
                          transform: "translate(-50%, -50%)",
                        }}
                      />
                    )}
                  </div>
                </div>
                  ) : (
                    <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full max-w-sm flex-col items-center rounded-2xl border-2 border-dashed border-ui-strong bg-surface/70 px-6 py-10 text-center transition-colors hover:border-action-outline hover:bg-action-subtle/50"
                >
                  <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-action-subtle text-action-emphasis">
                    <ImagePlus className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-bold text-ink-strong">
                    Choose a portrait to get started
                  </span>
                  <span className="mt-1 text-xs text-ink-faint">
                    Or drag and drop it here
                  </span>
                  <span className="mt-4 rounded-full bg-surface-subtle px-3 py-1 text-[10px] font-medium text-ink-muted">
                    JPG · PNG · WebP · Max 20 MB
                  </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <aside
            aria-label="Photo editing controls"
            className="flex flex-col gap-4 rounded-2xl border border-ui bg-surface p-4 shadow-sm sm:p-5 min-[850px]:sticky min-[850px]:top-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-ink-primary">
                Photo editor
              </h3>
              <AutoSaveStatusIndicator
                status={autoSave.status}
                lastSavedAt={autoSave.lastSavedAt}
                onRetry={autoSave.retry}
              />
            </div>

            <button
              type="button"
              disabled={
                !source ||
                isRemovingBackground ||
                isLoadingImage ||
                isMagicBrushActive
              }
              onClick={() => void removeBackground()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-action-emphasis px-4 py-3 text-sm font-bold text-ink-inverse shadow-sm transition-all hover:bg-action hover:shadow-md disabled:cursor-not-allowed disabled:bg-ui-strong disabled:shadow-none"
            >
              {isRemovingBackground ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {modelProgress === null
                    ? "Removing background…"
                    : `Downloading model · ${modelProgress}%`}
                </>
              ) : result ? (
                "Remove background again"
              ) : (
                "Remove background"
              )}
            </button>
            {isRemovingBackground && (
              <div role="status" aria-live="polite" className="space-y-1">
                <p className="text-[11px] text-ink-muted">
                  {modelProgress === null
                    ? "Removing the background locally. The first run may take longer while the model downloads."
                    : `Downloading the local model (${modelProgress}%).`}
                </p>
                {modelProgress !== null && (
                  <progress
                    aria-label="Local AI model download progress"
                    max="100"
                    value={modelProgress}
                    className="h-1.5 w-full accent-action-emphasis"
                  />
                )}
              </div>
            )}
            {result && (
              <div className="border-t border-ui-subtle pt-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-ink-primary">Background</h4>
                  <Palette className="h-4 w-4 text-ink-faint" aria-hidden="true" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  aria-label="Transparent background"
                  aria-pressed={background === "transparent"}
                  onClick={() => setBackground("transparent")}
                  className={`flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-emphasis ${
                    background === "transparent"
                      ? "border-action-accent bg-action-subtle/70"
                      : "border-ui hover:border-ui-strong hover:bg-surface-muted"
                  }`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ui bg-[conic-gradient(var(--theme-checker-dark)_25%,var(--theme-checker-light)_0_50%,var(--theme-checker-dark)_0_75%,var(--theme-checker-light)_0)] bg-[length:8px_8px]">
                    {background === "transparent" && (
                      <Check className="h-3.5 w-3.5 text-ink-primary" strokeWidth={3} aria-hidden="true" />
                    )}
                  </span>
                  <span className="truncate text-[11px] font-semibold text-ink-strong">Transparent</span>
                </button>
                {BACKGROUND_PRESETS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    aria-label={label}
                    aria-pressed={background === id}
                    onClick={() => setBackground(id)}
                    className={`flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-emphasis ${
                      background === id
                        ? "border-action-accent bg-action-subtle/70"
                        : "border-ui hover:border-ui-strong hover:bg-surface-muted"
                    }`}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ui"
                      style={{ backgroundColor: BACKGROUND_COLORS[id] }}
                    >
                      {background === id && (
                        <Check
                          className="h-3.5 w-3.5 text-ink-primary"
                          strokeWidth={3}
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <span className="truncate text-[11px] font-semibold text-ink-strong">{label}</span>
                  </button>
                ))}
                <label
                  className={`relative flex min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-xl border px-2.5 py-2 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-action-emphasis ${
                    background === "custom"
                      ? "border-action-accent bg-action-subtle/70"
                      : "border-ui hover:border-ui-strong hover:bg-surface-muted"
                  }`}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ui"
                    style={{
                      background:
                        background === "custom"
                          ? customColor
                          : "var(--theme-hue-picker-spectrum)",
                    }}
                  >
                    {background === "custom" && (
                      <Check className="h-3.5 w-3.5 text-ink-primary" strokeWidth={3} aria-hidden="true" />
                    )}
                  </span>
                  <span className="truncate text-[11px] font-semibold text-ink-strong">Custom</span>
                  <input
                    type="color"
                    aria-label="Custom background color"
                    value={customColor}
                    onClick={() => setBackground("custom")}
                      onChange={(event) => {
                        setCustomColor(event.target.value);
                        setBackground("custom");
                      }}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isSavingImage}
                    onClick={() => void downloadResult()}
                    className="flex min-w-0 items-center justify-center gap-2 rounded-xl bg-action-emphasis px-3 py-2.5 text-xs font-bold text-ink-inverse shadow-sm transition-colors hover:bg-action disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{isSavingImage ? "Preparing…" : "Download PNG"}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSavingImage}
                    onClick={() => void sendToPassportMaker()}
                    aria-label="Use in Passport Photo Maker"
                    title="Use in Passport Photo Maker"
                    className="flex min-w-0 items-center justify-center gap-2 rounded-xl bg-preview-muted px-3 py-2.5 text-xs font-bold text-ink-inverse shadow-sm transition-colors hover:bg-preview disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <SquareUserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">Photo Maker</span>
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-xl border border-danger-border bg-danger-subtle px-3 py-2 text-xs leading-relaxed text-danger">
                {error}
              </p>
            )}

          </aside>
        </div>
        </div>
      </div>
    </main>
  );
}
