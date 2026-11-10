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
  ChevronLeft,
  ChevronRight,
  Crop,
  ChevronDown,
  ChevronUp,
  FileArchive,
  FileImage,
  FileLock2,
  Files,
  Eraser,
  Hash,
  Image,
  LoaderCircle,
  ListOrdered,
  LockKeyholeOpen,
  RotateCw,
  Scissors,
  Stamp,
  Trash2,
  UploadCloud,
  X,
  type LucideIcon,
} from "lucide-react";
import BackToToolsButton from "./BackToToolsButton";
import AutoSaveStatusIndicator from "./AutoSaveStatusIndicator";
import DialogFrame from "./DialogFrame";
import { useToolAutoSave } from "../hooks/useToolAutoSave";
import { notifyUserSuccess } from "../lib/userNotifications";
import {
  addPageNumbers,
  addPdfWatermark,
  compressPdfFile,
  cropPdfFile,
  deletePdfPages,
  downloadPdfOutput,
  imagesToPdf,
  mergePdfFiles,
  organizePdfFile,
  parsePageOrder,
  parsePageRanges,
  pdfToImages,
  protectPdfFile,
  removePdfWatermarks,
  removeFlattenedWatermarkRegion,
  renderPdfPagePreview,
  renderPdfPageThumbnails,
  rotatePdfFile,
  splitPdfFile,
  unlockPdfFile,
  type PdfOutput,
  type PdfWatermarkPosition,
  type PdfWatermarkRegion,
} from "../lib/pdfTools";

export type PdfOperation =
  | "merge"
  | "split"
  | "compress"
  | "image-to-pdf"
  | "pdf-to-image"
  | "organize"
  | "delete-pages"
  | "rotate"
  | "crop"
  | "page-numbers"
  | "add-watermark"
  | "remove-watermark"
  | "protect"
  | "unlock";

const OPERATIONS: {
  id: PdfOperation;
  title: string;
  description: string;
  group: string;
  Icon: LucideIcon;
  multiple: boolean;
  images?: boolean;
}[] = [
  { id: "merge", title: "Merge PDF", description: "Combine PDF files in your chosen order.", group: "Organize", Icon: Files, multiple: true },
  { id: "split", title: "Split PDF", description: "Save each page range as a separate PDF.", group: "Organize", Icon: Scissors, multiple: false },
  { id: "organize", title: "Organize Pages", description: "Reorder pages by entering their page numbers.", group: "Organize", Icon: ListOrdered, multiple: false },
  { id: "delete-pages", title: "Delete Pages", description: "Remove selected pages and keep the rest of the PDF.", group: "Organize", Icon: Trash2, multiple: false },
  { id: "image-to-pdf", title: "Image to PDF", description: "Put each selected image on its own PDF page.", group: "Convert", Icon: Image, multiple: true, images: true },
  { id: "pdf-to-image", title: "PDF to Image", description: "Export every page as a high-resolution PNG image.", group: "Convert", Icon: FileImage, multiple: false },
  { id: "compress", title: "Compress PDF", description: "Reduce file size by rasterizing pages; text will no longer be selectable.", group: "Edit", Icon: FileArchive, multiple: false },
  { id: "rotate", title: "Rotate PDF", description: "Rotate every page by the selected angle.", group: "Edit", Icon: RotateCw, multiple: false },
  { id: "crop", title: "Crop PDF", description: "Set an equal crop margin on all four sides.", group: "Edit", Icon: Crop, multiple: false },
  { id: "page-numbers", title: "Add Page Numbers", description: "Add page and total-page numbers to each page.", group: "Edit", Icon: Hash, multiple: false },
  { id: "add-watermark", title: "Add Watermark", description: "Stamp custom text across every PDF page.", group: "Edit", Icon: Stamp, multiple: false },
  { id: "remove-watermark", title: "Remove Watermark", description: "Remove watermark annotations, find text marks, or cover a selected area.", group: "Edit", Icon: Eraser, multiple: false },
  { id: "protect", title: "Protect PDF", description: "Encrypt the PDF with an AES-256 opening password.", group: "Security", Icon: FileLock2, multiple: false },
  { id: "unlock", title: "Unlock PDF", description: "Remove PDF passwords; AES-128 files are exported as flattened pages.", group: "Security", Icon: LockKeyholeOpen, multiple: false },
];

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function isPasswordOperation(operation: PdfOperation): boolean {
  return operation === "protect" || operation === "unlock";
}

function pdfOutput(bytes: Uint8Array, filename: string): PdfOutput {
  return { bytes, filename };
}

function baseName(name: string): string {
  return name.replace(/\.pdf$/i, "") || "document";
}

interface PdfToolsSession {
  version: 1;
  operation: PdfOperation;
  files: File[];
  pageRanges: string;
  pageOrder: string;
  rotation: number;
  cropMargin: number;
  quality: number;
  readyOutputs: PdfOutput[];
  watermarkText?: string;
  watermarkOpacity?: number;
  watermarkType?: "text" | "image";
  watermarkImage?: File | null;
  watermarkPosition?: PdfWatermarkPosition;
  watermarkSize?: number;
  watermarkRotation?: number;
  watermarkPages?: string;
  watermarkColor?: string;
  watermarkRemovalMode?: "annotations" | "text-match" | "flattened-region";
  watermarkRemovalRegion?: PdfWatermarkRegion | null;
  watermarkMatchText?: string;
  watermarkRemovalFillColor?: string;
}

interface FilePreviewSelection {
  file: File;
  pageNumber: number;
  pageCount: number;
  isImage: boolean;
}

function ImageFileThumbnail({
  file,
  onPreview,
}: {
  file: File;
  onPreview: () => void;
}) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <button
      type="button"
      onClick={onPreview}
      disabled={!url}
      aria-label={`Preview image ${file.name}`}
      className="group relative mt-2 flex h-28 w-full items-center justify-center overflow-hidden rounded-lg border border-ui bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-contain p-1" />
      ) : (
        <LoaderCircle className="h-5 w-5 animate-spin text-action" aria-hidden="true" />
      )}
      <span className="absolute inset-x-0 bottom-0 bg-preview/75 py-1 text-[10px] font-semibold text-ink-inverse opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        Click to preview
      </span>
    </button>
  );
}

function PdfPageThumbnails({
  file,
  onPreview,
}: {
  file: File;
  onPreview: (pageNumber: number, pageCount: number) => void;
}) {
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    setThumbnails([]);
    setError("");
    void renderPdfPageThumbnails(file)
      .then((pages) => {
        if (active) setThumbnails(pages);
      })
      .catch((previewError: unknown) => {
        console.error(`Unable to preview pages in ${file.name}`, previewError);
        if (active) {
          setError(previewError instanceof Error
            ? previewError.message
            : "Page previews could not be loaded.");
        }
      });
    return () => {
      active = false;
    };
  }, [file, retryCount]);

  if (error) {
    return (
      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-warning-subtle px-2.5 py-2 text-[10px] text-warning-strong">
        <span className="min-w-0 truncate">Page previews unavailable</span>
        <button
          type="button"
          onClick={() => setRetryCount((count) => count + 1)}
          className="shrink-0 rounded px-2 py-1 font-semibold hover:bg-warning-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!thumbnails.length) {
    return (
      <div className="mt-2 flex h-20 items-center justify-center rounded-lg bg-surface-muted text-[10px] text-ink-muted">
        <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Loading page previews…
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
      {thumbnails.map((thumbnail, index) => {
        const pageNumber = index + 1;
        return (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onPreview(pageNumber, thumbnails.length)}
            aria-label={`Preview page ${pageNumber} of ${thumbnails.length}`}
            className="group min-w-0 rounded-lg border border-ui bg-surface-muted p-1.5 text-center transition-colors hover:border-action-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          >
            <span className="flex h-24 items-center justify-center overflow-hidden rounded bg-surface">
              <img src={thumbnail} alt="" className="max-h-full max-w-full object-contain" />
            </span>
            <span className="mt-1 block truncate text-[10px] font-medium text-ink-muted group-hover:text-action">
              Page {pageNumber}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FilePreviewDialog({
  selection,
  onClose,
  onPageChange,
}: {
  selection: FilePreviewSelection;
  onClose: () => void;
  onPageChange: (pageNumber: number) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setPreviewUrl("");
    setError("");
    setIsLoading(true);

    const loadPreview = async () => {
      try {
        if (selection.isImage) {
          objectUrl = URL.createObjectURL(selection.file);
          if (active) setPreviewUrl(objectUrl);
        } else {
          const renderedPage = await renderPdfPagePreview(
            selection.file,
            selection.pageNumber,
          );
          if (active) setPreviewUrl(renderedPage);
        }
      } catch (previewError) {
        console.error(`Unable to preview ${selection.file.name}`, previewError);
        if (active) {
          setError(previewError instanceof Error
            ? previewError.message
            : "The preview could not be loaded.");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadPreview();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selection]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (selection.isImage) return;
      if (event.key === "ArrowLeft" && selection.pageNumber > 1) {
        onPageChange(selection.pageNumber - 1);
      }
      if (event.key === "ArrowRight" && selection.pageNumber < selection.pageCount) {
        onPageChange(selection.pageNumber + 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onPageChange, selection]);

  return (
    <DialogFrame
      labelledBy="file-preview-title"
      describedBy="file-preview-description"
      panelClassName="flex h-[calc(100dvh-2rem)] max-h-[900px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl"
      onBackdropDismiss={onClose}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-ui px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 id="file-preview-title" className="truncate text-sm font-bold text-ink-primary">
            {selection.file.name}
          </h2>
          <p id="file-preview-description" className="mt-0.5 text-xs text-ink-muted">
            {selection.isImage
              ? "Image preview"
              : `Page ${selection.pageNumber} of ${selection.pageCount}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="shrink-0 rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-auto bg-preview-muted p-4 sm:p-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-ink-inverse" role="status">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
            Loading preview…
          </div>
        ) : error ? (
          <p role="alert" className="rounded-lg bg-danger-subtle px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : (
          <img
            src={previewUrl}
            alt={`${selection.file.name}${selection.isImage ? "" : `, page ${selection.pageNumber}`}`}
            className="block max-h-full max-w-full object-contain shadow-xl"
          />
        )}
      </div>
      {!selection.isImage && (
        <footer className="flex shrink-0 items-center justify-center gap-4 border-t border-ui px-4 py-3">
          <button
            type="button"
            aria-label="Previous page"
            disabled={selection.pageNumber <= 1}
            onClick={() => onPageChange(selection.pageNumber - 1)}
            className="rounded-lg border border-ui px-3 py-2 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="min-w-20 text-center text-xs font-medium text-ink-secondary">
            {selection.pageNumber} / {selection.pageCount}
          </span>
          <button
            type="button"
            aria-label="Next page"
            disabled={selection.pageNumber >= selection.pageCount}
            onClick={() => onPageChange(selection.pageNumber + 1)}
            className="rounded-lg border border-ui px-3 py-2 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </footer>
      )}
    </DialogFrame>
  );
}

const PDF_OPERATION_IDS = OPERATIONS.map(({ id }) => id);

export default function PdfTools({
  onClose,
  initialOperation,
  lockedOperation,
}: {
  onClose: () => void;
  initialOperation?: PdfOperation;
  lockedOperation?: PdfOperation;
}) {
  const [operation, setOperation] = useState<PdfOperation>(
    lockedOperation ?? initialOperation ?? "merge",
  );
  const [files, setFiles] = useState<File[]>([]);
  const [pageRanges, setPageRanges] = useState("");
  const [pageOrder, setPageOrder] = useState("");
  const [watermarkText, setWatermarkText] = useState("SAMPLE");
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.2);
  const [watermarkType, setWatermarkType] = useState<"text" | "image">("text");
  const [watermarkImage, setWatermarkImage] = useState<File | null>(null);
  const [watermarkPosition, setWatermarkPosition] = useState<PdfWatermarkPosition>("diagonal");
  const [watermarkSize, setWatermarkSize] = useState(55);
  const [watermarkRotation, setWatermarkRotation] = useState(0);
  const [watermarkPages, setWatermarkPages] = useState("");
  const [watermarkColor, setWatermarkColor] = useState("#595959");
  const [watermarkRemovalMode, setWatermarkRemovalMode] =
    useState<"annotations" | "text-match" | "flattened-region">("annotations");
  const [watermarkRemovalRegion, setWatermarkRemovalRegion] =
    useState<PdfWatermarkRegion | null>(null);
  const [watermarkMatchText, setWatermarkMatchText] = useState("");
  const [watermarkRemovalPreview, setWatermarkRemovalPreview] = useState("");
  const [watermarkRemovalPreviewError, setWatermarkRemovalPreviewError] = useState("");
  const [watermarkRemovalPreviewLoading, setWatermarkRemovalPreviewLoading] = useState(false);
  const [watermarkRemovalFillColor, setWatermarkRemovalFillColor] = useState("#ffffff");
  const removalDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [rotation, setRotation] = useState(90);
  const [cropMargin, setCropMargin] = useState(5);
  const [quality, setQuality] = useState(60);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [readyOutputs, setReadyOutputs] = useState<PdfOutput[]>([]);
  const [previewSelection, setPreviewSelection] = useState<FilePreviewSelection | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOperation = OPERATIONS.find((item) => item.id === operation)!;
  const operationGroups = [...new Set(OPERATIONS.map((item) => item.group))];
  const needsMultiple = selectedOperation.multiple;
  const passwordMismatch = operation === "protect" && password !== passwordConfirm;
  const closePreview = useCallback(() => setPreviewSelection(null), []);
  const openPreview = useCallback((
    file: File,
    pageNumber: number,
    pageCount: number,
    isImage: boolean,
  ) => {
    setPreviewSelection({ file, pageNumber, pageCount, isImage });
  }, []);
  const changePreviewPage = useCallback((pageNumber: number) => {
    setPreviewSelection((current) => current ? { ...current, pageNumber } : current);
  }, []);

  const restoreSession = useCallback(async (saved: PdfToolsSession) => {
    if (
      saved.version !== 1 ||
      !PDF_OPERATION_IDS.includes(saved.operation) ||
      (lockedOperation !== undefined && saved.operation !== lockedOperation) ||
      !Array.isArray(saved.files) ||
      !saved.files.every((file) => file instanceof File) ||
      typeof saved.pageRanges !== "string" ||
      typeof saved.pageOrder !== "string" ||
      (saved.watermarkText !== undefined && typeof saved.watermarkText !== "string") ||
      (saved.watermarkOpacity !== undefined &&
        (!Number.isFinite(saved.watermarkOpacity) ||
          saved.watermarkOpacity < 0.05 ||
          saved.watermarkOpacity > 0.8)) ||
      (saved.watermarkType !== undefined &&
        saved.watermarkType !== "text" && saved.watermarkType !== "image") ||
      (saved.watermarkImage !== undefined &&
        saved.watermarkImage !== null && !(saved.watermarkImage instanceof File)) ||
      (saved.watermarkPosition !== undefined &&
        !["center", "top-left", "top-right", "bottom-left", "bottom-right", "diagonal"]
          .includes(saved.watermarkPosition)) ||
      (saved.watermarkSize !== undefined &&
        (!Number.isFinite(saved.watermarkSize) || saved.watermarkSize < 10 || saved.watermarkSize > 80)) ||
      (saved.watermarkRotation !== undefined &&
        (!Number.isFinite(saved.watermarkRotation) ||
          saved.watermarkRotation < -90 || saved.watermarkRotation > 90)) ||
      (saved.watermarkPages !== undefined && typeof saved.watermarkPages !== "string") ||
      (saved.watermarkColor !== undefined &&
        !/^#?[\da-f]{6}$/i.test(saved.watermarkColor)) ||
      (saved.watermarkRemovalMode !== undefined &&
        saved.watermarkRemovalMode !== "annotations" &&
        saved.watermarkRemovalMode !== "text-match" &&
        saved.watermarkRemovalMode !== "flattened-region") ||
      (saved.watermarkMatchText !== undefined &&
        (typeof saved.watermarkMatchText !== "string" || saved.watermarkMatchText.length > 100)) ||
      (saved.watermarkRemovalFillColor !== undefined &&
        !/^#?[\da-f]{6}$/i.test(saved.watermarkRemovalFillColor)) ||
      (saved.watermarkRemovalRegion !== undefined &&
        saved.watermarkRemovalRegion !== null &&
        (![saved.watermarkRemovalRegion.x, saved.watermarkRemovalRegion.y,
          saved.watermarkRemovalRegion.width, saved.watermarkRemovalRegion.height].every(Number.isFinite) ||
          saved.watermarkRemovalRegion.x < 0 ||
          saved.watermarkRemovalRegion.y < 0 ||
          saved.watermarkRemovalRegion.width <= 0 ||
          saved.watermarkRemovalRegion.height <= 0 ||
          saved.watermarkRemovalRegion.x + saved.watermarkRemovalRegion.width > 1 ||
          saved.watermarkRemovalRegion.y + saved.watermarkRemovalRegion.height > 1)) ||
      ![90, 180, 270].includes(saved.rotation) ||
      !Number.isFinite(saved.cropMargin) ||
      saved.cropMargin < 0 ||
      saved.cropMargin > 40 ||
      !Number.isFinite(saved.quality) ||
      saved.quality < 20 ||
      saved.quality > 95 ||
      !Array.isArray(saved.readyOutputs) ||
      !saved.readyOutputs.every((output) =>
        typeof output.filename === "string" &&
        output.bytes instanceof Uint8Array,
      )
    ) {
      throw new Error("The saved PDF Tools session is invalid.");
    }

    const restoredOperation = OPERATIONS.find((item) => item.id === saved.operation)!;
    const validFiles = saved.files.every((file) => restoredOperation.images
      ? file.type.startsWith("image/")
      : isPdf(file));
    if (!validFiles || (!restoredOperation.multiple && saved.files.length > 1)) {
      throw new Error("The saved PDF Tools files do not match the selected tool.");
    }

    setOperation(saved.operation);
    setFiles(saved.files);
    setPageRanges(saved.pageRanges);
    setPageOrder(saved.pageOrder);
    setWatermarkText(saved.watermarkText ?? "SAMPLE");
    setWatermarkOpacity(saved.watermarkOpacity ?? 0.2);
    setWatermarkType(saved.watermarkType ?? "text");
    setWatermarkImage(saved.watermarkImage ?? null);
    setWatermarkPosition(saved.watermarkPosition ?? "diagonal");
    setWatermarkSize(saved.watermarkSize ?? 55);
    setWatermarkRotation(saved.watermarkRotation ?? 0);
    setWatermarkPages(saved.watermarkPages ?? "");
    setWatermarkColor(saved.watermarkColor ?? "#595959");
    setWatermarkRemovalMode(saved.watermarkRemovalMode ?? "annotations");
    setWatermarkRemovalRegion(saved.watermarkRemovalRegion ?? null);
    setWatermarkMatchText(saved.watermarkMatchText ?? "");
    setWatermarkRemovalFillColor(saved.watermarkRemovalFillColor ?? "#ffffff");
    setRotation(saved.rotation);
    setCropMargin(saved.cropMargin);
    setQuality(saved.quality);
    setReadyOutputs(saved.readyOutputs);
    setPassword("");
    setPasswordConfirm("");
    setError("");
  }, [lockedOperation]);

  const autosaveSnapshot = useMemo<PdfToolsSession>(() => ({
    version: 1,
    operation,
    files,
    pageRanges,
    pageOrder,
    rotation,
    cropMargin,
    quality,
    readyOutputs,
    watermarkText,
    watermarkOpacity,
    watermarkType,
    watermarkImage,
    watermarkPosition,
    watermarkSize,
    watermarkRotation,
    watermarkPages,
    watermarkColor,
    watermarkRemovalMode,
    watermarkRemovalRegion,
    watermarkMatchText,
    watermarkRemovalFillColor,
  }), [
    cropMargin,
    files,
    operation,
    pageOrder,
    pageRanges,
    quality,
    readyOutputs,
    rotation,
    watermarkOpacity,
    watermarkType,
    watermarkImage,
    watermarkPosition,
    watermarkSize,
    watermarkRotation,
    watermarkPages,
    watermarkColor,
    watermarkRemovalMode,
    watermarkRemovalRegion,
    watermarkMatchText,
    watermarkRemovalFillColor,
    watermarkText,
  ]);
  const autoSave = useToolAutoSave(
    `pdf-tools-${lockedOperation ?? "all"}`,
    autosaveSnapshot,
    restoreSession,
    !isProcessing,
  );

  const canProcess =
    files.length > 0 &&
    (!needsMultiple || files.length > 1) &&
    !isProcessing &&
    (operation !== "add-watermark" ||
      (watermarkType === "text" ? Boolean(watermarkText.trim()) : Boolean(watermarkImage))) &&
    (operation !== "remove-watermark" ||
      watermarkRemovalMode === "annotations" ||
      (watermarkRemovalMode === "text-match" && Boolean(watermarkMatchText.trim())) ||
      (watermarkRemovalMode === "flattened-region" && watermarkRemovalRegion !== null)) &&
    (!isPasswordOperation(operation) || Boolean(password)) &&
    !passwordMismatch;

  const selectOperation = (nextOperation: PdfOperation) => {
    setOperation(nextOperation);
    setPreviewSelection(null);
    setFiles([]);
    setPassword("");
    setPasswordConfirm("");
    setError("");
    setReadyOutputs([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const selectFiles = (selected: FileList | null) => {
    setPreviewSelection(null);
    const incoming = Array.from(selected ?? []);
    const valid = incoming.filter((file) => selectedOperation.images
      ? file.type.startsWith("image/")
      : isPdf(file));
    const allValid = valid.length === incoming.length;
    if (valid.length > 0) {
      setFiles((current) => needsMultiple
        ? [...current, ...valid]
        : valid.slice(0, 1));
      setReadyOutputs([]);
      setWatermarkRemovalRegion(null);
    }
    setError(allValid
      ? ""
      : selectedOperation.images
        ? "Choose image files supported by your browser."
        : "Choose PDF files only.");
    setReadyOutputs([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  useEffect(() => {
    const file = files[0];
    if (operation !== "remove-watermark" || watermarkRemovalMode !== "flattened-region" || !file) {
      setWatermarkRemovalPreview("");
      setWatermarkRemovalPreviewError("");
      setWatermarkRemovalPreviewLoading(false);
      return;
    }

    let active = true;
    setWatermarkRemovalPreview("");
    setWatermarkRemovalPreviewError("");
    setWatermarkRemovalPreviewLoading(true);
    void renderPdfPagePreview(file, 1, 0.8)
      .then((preview) => {
        if (active) setWatermarkRemovalPreview(preview);
      })
      .catch((previewError: unknown) => {
        console.error(`Unable to preview ${file.name} for watermark cleanup`, previewError);
        if (active) {
          setWatermarkRemovalPreviewError(previewError instanceof Error
            ? previewError.message
            : "The PDF page preview could not be loaded.");
        }
      })
      .finally(() => {
        if (active) setWatermarkRemovalPreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [files, operation, watermarkRemovalMode]);

  const getWatermarkRegionPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    };
  };
  const startWatermarkRegion = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!watermarkRemovalPreview) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getWatermarkRegionPoint(event);
    removalDragStartRef.current = point;
    setWatermarkRemovalRegion({ ...point, width: 0.005, height: 0.005 });
    setReadyOutputs([]);
  };
  const moveWatermarkRegion = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = removalDragStartRef.current;
    if (!start) return;
    const point = getWatermarkRegionPoint(event);
    const x = Math.min(start.x, point.x);
    const y = Math.min(start.y, point.y);
    setWatermarkRemovalRegion({
      x,
      y,
      width: Math.min(1 - x, Math.max(0.005, Math.abs(point.x - start.x))),
      height: Math.min(1 - y, Math.max(0.005, Math.abs(point.y - start.y))),
    });
  };
  const finishWatermarkRegion = () => {
    removalDragStartRef.current = null;
  };

  useEffect(() => {
    const requestedOperation = lockedOperation ?? initialOperation;
    if (requestedOperation && autoSave.isLoaded && operation !== requestedOperation) {
      setOperation(requestedOperation);
      setFiles([]);
      setReadyOutputs([]);
      setPassword("");
      setPasswordConfirm("");
      setError("");
    }
  }, [autoSave.isLoaded, initialOperation, lockedOperation, operation]);

  const process = async () => {
    if (!canProcess) return;
    setError("");
    setReadyOutputs([]);
    setIsProcessing(true);
    try {
      const file = files[0];
      let outputs: PdfOutput[];
      let completionNote = "";
      switch (operation) {
        case "merge":
          outputs = [pdfOutput(await mergePdfFiles(files), "merged.pdf")];
          break;
        case "add-watermark":
          {
            const { PDFDocument } = await import("pdf-lib");
            const source = await PDFDocument.load(await file.arrayBuffer());
            const selectedPages = watermarkPages.trim()
              ? parsePageRanges(watermarkPages, source.getPageCount()).flat()
              : undefined;
          outputs = [pdfOutput(
            await addPdfWatermark(file, {
              type: watermarkType,
              text: watermarkText,
              image: watermarkImage,
              opacity: watermarkOpacity,
              position: watermarkPosition,
              size: watermarkSize,
              rotation: watermarkRotation,
              pages: selectedPages,
              color: watermarkColor,
            }),
            `${baseName(file.name)}-watermarked.pdf`,
          )];
          break;
          }
        case "remove-watermark":
          if (watermarkRemovalMode === "flattened-region") {
            if (!watermarkRemovalRegion) {
              throw new Error("Draw a selection around the flattened watermark area first.");
            }
            {
              const { PDFDocument } = await import("pdf-lib");
              const source = await PDFDocument.load(await file.arrayBuffer());
              const selectedPages = watermarkPages.trim()
                ? parsePageRanges(watermarkPages, source.getPageCount()).flat()
                : undefined;
              outputs = [pdfOutput(
                await removeFlattenedWatermarkRegion(file, {
                  region: watermarkRemovalRegion,
                  pages: selectedPages,
                  fillColor: watermarkRemovalFillColor,
                }),
                `${baseName(file.name)}-watermark-area-cleaned.pdf`,
              )];
            }
          } else if (watermarkRemovalMode === "text-match") {
            const { PDFDocument } = await import("pdf-lib");
            const source = await PDFDocument.load(await file.arrayBuffer());
            const selectedPages = watermarkPages.trim()
              ? parsePageRanges(watermarkPages, source.getPageCount()).flat()
              : undefined;
            outputs = [pdfOutput(
              await removeFlattenedWatermarkRegion(file, {
                text: watermarkMatchText,
                pages: selectedPages,
                fillColor: watermarkRemovalFillColor,
              }),
              `${baseName(file.name)}-watermark-text-cleaned.pdf`,
            )];
          } else {
            outputs = [pdfOutput(
              await removePdfWatermarks(file),
              `${baseName(file.name)}-watermark-removed.pdf`,
            )];
          }
          break;
        case "split": {
          const { PDFDocument } = await import("pdf-lib");
          const source = await PDFDocument.load(await file.arrayBuffer());
          const ranges = parsePageRanges(pageRanges, source.getPageCount());
          outputs = await splitPdfFile(file, ranges);
          break;
        }
        case "delete-pages": {
          const { PDFDocument } = await import("pdf-lib");
          const source = await PDFDocument.load(await file.arrayBuffer());
          const pages = parsePageRanges(pageRanges, source.getPageCount()).flat();
          outputs = [pdfOutput(
            await deletePdfPages(file, pages),
            `${baseName(file.name)}-pages-deleted.pdf`,
          )];
          break;
        }
        case "compress":
          outputs = [pdfOutput(
            await compressPdfFile(file, quality),
            `${baseName(file.name)}-compressed.pdf`,
          )];
          break;
        case "image-to-pdf":
          outputs = [pdfOutput(await imagesToPdf(files), "images.pdf")];
          break;
        case "pdf-to-image":
          outputs = await pdfToImages(file);
          break;
        case "organize": {
          const { PDFDocument } = await import("pdf-lib");
          const source = await PDFDocument.load(await file.arrayBuffer());
          outputs = [pdfOutput(
            await organizePdfFile(file, parsePageOrder(pageOrder, source.getPageCount())),
            `${baseName(file.name)}-organized.pdf`,
          )];
          break;
        }
        case "rotate":
          outputs = [pdfOutput(
            await rotatePdfFile(file, rotation),
            `${baseName(file.name)}-rotated.pdf`,
          )];
          break;
        case "crop":
          outputs = [pdfOutput(
            await cropPdfFile(file, cropMargin),
            `${baseName(file.name)}-cropped.pdf`,
          )];
          break;
        case "page-numbers":
          outputs = [pdfOutput(
            await addPageNumbers(file),
            `${baseName(file.name)}-numbered.pdf`,
          )];
          break;
        case "protect":
          outputs = [pdfOutput(
            await protectPdfFile(file, password),
            `${baseName(file.name)}-protected.pdf`,
          )];
          break;
        case "unlock":
          {
            const unlocked = await unlockPdfFile(file, password);
            outputs = [pdfOutput(
              unlocked.bytes,
              `${baseName(file.name)}-${unlocked.flattened ? "unlocked-flattened" : "unlocked"}.pdf`,
            )];
            if (unlocked.flattened) {
              completionNote = " AES-128 content was flattened, so text and forms are not editable.";
            }
          }
          break;
      }

      setReadyOutputs(outputs);
      if (isPasswordOperation(operation)) {
        setPassword("");
        setPasswordConfirm("");
      }
      const successMessage = (() => {
        switch (operation) {
          case "merge": return "PDFs merged.";
          case "split": return `PDF split into ${outputs.length} files.`;
          case "compress": return "PDF compressed.";
          case "image-to-pdf": return "Images converted to PDF.";
          case "pdf-to-image": return `Exported ${outputs.length} PDF pages as images.`;
          case "organize": return "PDF pages reordered.";
          case "delete-pages": return "Selected PDF pages deleted.";
          case "rotate": return "PDF rotated.";
          case "crop": return "PDF cropped.";
          case "page-numbers": return "Page numbers added.";
          case "add-watermark": return "Watermark added.";
          case "remove-watermark": return watermarkRemovalMode === "flattened-region"
            ? "Selected watermark area covered; PDF pages were rasterized."
            : watermarkRemovalMode === "text-match"
              ? "Matching PDF text covered; PDF pages were rasterized."
              : "Removable watermark annotations removed.";
          case "protect": return "PDF protected.";
          case "unlock": return completionNote
            ? "PDF unlocked; pages were flattened."
            : "PDF unlocked.";
        }
      })();
      notifyUserSuccess(successMessage);
    } catch (caught) {
      console.error("PDF tool operation failed", caught);
      setError(caught instanceof Error ? caught.message : "The PDF operation failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
    <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-muted">
      <header className="flex shrink-0 items-center border-b border-ui bg-surface px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
          <BackToToolsButton
            onClick={onClose}
            toolName={lockedOperation ? selectedOperation.title : "PDF Tools"}
          />
          <AutoSaveStatusIndicator
            status={autoSave.status}
            lastSavedAt={autoSave.lastSavedAt}
            onRetry={autoSave.retry}
          />
        </div>
      </header>

      <div className={`mx-auto grid min-h-0 w-full max-w-7xl flex-1 grid-cols-1 auto-rows-max gap-3 overflow-y-auto p-3 sm:gap-4 sm:p-4 min-[1000px]:auto-rows-fr min-[1000px]:overflow-hidden ${
        lockedOperation
          ? "min-[1000px]:grid-cols-[minmax(0,1fr)_290px]"
          : "min-[1000px]:grid-cols-[230px_minmax(0,1fr)_290px]"
      }`}>
        {!lockedOperation && (
          <>
        <nav
          aria-label="PDF operations"
          className="flex gap-2 overflow-x-auto rounded-2xl border border-ui bg-surface p-2 min-[1000px]:hidden"
        >
          {OPERATIONS.map(({ id, title, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={operation === id}
              onClick={() => selectOperation(id)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                operation === id
                  ? "bg-action-subtle text-action-hover"
                  : "text-ink-secondary hover:bg-surface-muted"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {title}
            </button>
          ))}
        </nav>

        <aside className="hidden min-h-0 overflow-y-auto rounded-2xl border border-ui bg-surface p-3 shadow-sm min-[1000px]:block">
          <h2 className="px-2 pb-3 pt-1 text-xs font-bold uppercase tracking-wide text-ink-muted">
            PDF tools
          </h2>
          <div className="space-y-4">
            {operationGroups.map((group) => (
              <section key={group} aria-label={group}>
                <h3 className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                  {group}
                </h3>
                <div className="space-y-0.5">
                  {OPERATIONS.filter((item) => item.group === group).map(({ id, title, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={operation === id}
                      onClick={() => selectOperation(id)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-xs font-semibold transition-colors ${
                        operation === id
                          ? "bg-action-subtle text-action-hover"
                          : "text-ink-secondary hover:bg-surface-muted"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {title}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </aside>
          </>
        )}

        <section className="flex min-h-72 flex-col overflow-hidden rounded-2xl border border-ui bg-surface shadow-sm min-[1000px]:min-h-0">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-ui-subtle px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-action-subtle text-action">
                <selectedOperation.Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold text-ink-primary">{selectedOperation.title}</h1>
                <p className="mt-0.5 text-xs leading-5 text-ink-muted">{selectedOperation.description}</p>
              </div>
            </div>
            <span className="hidden shrink-0 rounded-full bg-surface-subtle px-2.5 py-1 text-[10px] font-semibold text-ink-muted sm:inline-flex">
              {selectedOperation.images ? "IMAGE FILES" : "PDF FILES"}
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
            <input
              ref={inputRef}
              type="file"
              accept={selectedOperation.images ? "image/*" : ".pdf,application/pdf"}
              multiple={needsMultiple}
              onChange={(event) => selectFiles(event.target.files)}
              className="sr-only"
              aria-label={selectedOperation.images ? "Choose images" : "Choose PDF files"}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragOver(false);
                selectFiles(event.dataTransfer.files);
              }}
              className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action ${
                files.length ? "min-h-36 shrink-0" : "min-h-56 flex-1"
              } ${
                isDragOver
                  ? "scale-[1.01] border-action-accent bg-action-subtle"
                  : "border-ui-strong bg-surface-muted hover:border-action-outline hover:bg-action-subtle/50"
              }`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-action shadow-sm">
                {selectedOperation.images
                  ? <FileImage className="h-6 w-6" aria-hidden="true" />
                  : <UploadCloud className="h-6 w-6" aria-hidden="true" />}
              </span>
              <span className="mt-3 text-sm font-bold text-ink-primary">
                {files.length
                  ? needsMultiple ? "Add more files" : "Replace file"
                  : "Drop files here or browse"}
              </span>
              <span className="mt-1 text-xs text-ink-muted">
                {needsMultiple
                  ? "Add files one at a time or select several, then arrange their order below."
                  : selectedOperation.images
                    ? "Select one or more images · JPG, PNG, WebP"
                    : "Select one PDF file"}
              </span>
              {!files.length && (
                <span className="mt-3 rounded-full bg-surface px-3 py-1 text-[10px] font-medium text-ink-muted">
                  {selectedOperation.images ? "Images are converted locally" : "PDF documents · processed locally"}
                </span>
              )}
            </button>

            {files.length > 0 && (
              <section aria-label="Selected files" className="min-w-0">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                    Selected files <span className="text-ink-faint">({files.length})</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setFiles([]);
                      setReadyOutputs([]);
                      setError("");
                      setPreviewSelection(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-ink-muted transition-colors hover:bg-error-subtle hover:text-error-hover"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Clear
                  </button>
                </div>
                <ul className="space-y-2">
                  {files.map((file, index) => (
                    <li
                      key={`${file.name}-${file.lastModified}-${index}`}
                      className="min-w-0 rounded-xl border border-ui bg-surface p-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger-subtle text-danger">
                          {selectedOperation.images
                            ? <FileImage className="h-4 w-4" aria-hidden="true" />
                            : <Files className="h-4 w-4" aria-hidden="true" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-ink-strong">{file.name}</span>
                          <span className="mt-0.5 block text-[10px] text-ink-muted">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </span>
                        </span>
                        {needsMultiple && (
                          <span className="flex shrink-0 gap-0.5">
                            <button
                              type="button"
                              aria-label={`Move ${file.name} up`}
                              disabled={index === 0}
                              onClick={() => setFiles((current) => {
                                const next = [...current];
                                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                setReadyOutputs([]);
                                return next;
                              })}
                              className="rounded-md p-1.5 text-ink-muted hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              <ChevronUp className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Move ${file.name} down`}
                              disabled={index === files.length - 1}
                              onClick={() => setFiles((current) => {
                                const next = [...current];
                                [next[index], next[index + 1]] = [next[index + 1], next[index]];
                                setReadyOutputs([]);
                                return next;
                              })}
                              className="rounded-md p-1.5 text-ink-muted hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              <ChevronDown className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </span>
                        )}
                      </div>
                      {selectedOperation.images ? (
                        <ImageFileThumbnail
                          file={file}
                          onPreview={() => openPreview(file, 1, 1, true)}
                        />
                      ) : (
                        <PdfPageThumbnails
                          file={file}
                          onPreview={(pageNumber, pageCount) =>
                            openPreview(file, pageNumber, pageCount, false)
                          }
                        />
                      )}
                    </li>
                  ))}
                </ul>
                {operation === "merge" && files.length === 1 && (
                  <p className="mt-2 text-xs text-warning-strong">Add at least one more PDF to merge.</p>
                )}
              </section>
            )}

            {operation === "delete-pages" && (
              <label className="block text-xs font-semibold text-ink-secondary">
                Pages to delete
                <input
                  value={pageRanges}
                  onChange={(event) => setPageRanges(event.target.value)}
                  placeholder="For example: 2, 4-5"
                  className="mt-1.5 w-full rounded-lg border border-ui-strong bg-surface px-3 py-2.5 text-sm font-normal text-ink-primary outline-none focus:border-action focus:ring-2 focus:ring-action-subtle"
                />
                <span className="mt-1.5 block text-[11px] font-normal leading-4 text-ink-muted">
                  Enter pages or ranges to remove. At least one page must remain.
                </span>
              </label>
            )}

            {operation === "remove-watermark" && (
              <div className="space-y-4">
                <label className="block text-xs font-semibold text-ink-secondary">
                  Removal method
                  <select
                    value={watermarkRemovalMode}
                    onChange={(event) => {
                      setWatermarkRemovalMode(
                        event.target.value as "annotations" | "text-match" | "flattened-region",
                      );
                      setWatermarkRemovalRegion(null);
                      setReadyOutputs([]);
                      setError("");
                    }}
                    className="mt-1.5 w-full rounded-lg border border-ui-strong bg-surface px-3 py-2.5 text-sm font-normal text-ink-primary outline-none focus:border-action focus:ring-2 focus:ring-action-subtle"
                  >
                    <option value="annotations">Remove watermark annotations</option>
                    <option value="text-match">Find and cover matching PDF text</option>
                    <option value="flattened-region">Cover a flattened watermark area</option>
                  </select>
                </label>

                {watermarkRemovalMode === "annotations" ? (
                  <p className="rounded-xl border border-ui bg-surface-muted px-3 py-3 text-xs leading-5 text-ink-secondary">
                    Removes PDF Watermark annotations, named Watermark stamps, and watermarks added by this app. It does not guess which ordinary page text or graphics are watermarks.
                  </p>
                ) : (
                  <>
                    <p className="rounded-xl border border-warning-border bg-warning-subtle px-3 py-3 text-xs leading-5 text-warning-strong">
                      {watermarkRemovalMode === "text-match"
                        ? "Enter the exact watermark wording. Matching selectable text is covered on chosen pages. This rasterizes every page and cannot restore content hidden beneath the watermark."
                        : "Drag over the watermark on page 1. The selected rectangle is covered on chosen pages. This rasterizes every page and cannot restore content hidden beneath the watermark."}
                    </p>
                    {watermarkRemovalMode === "text-match" && (
                      <label className="block text-xs font-semibold text-ink-secondary">
                        Watermark text to find
                        <input
                          value={watermarkMatchText}
                          maxLength={100}
                          onChange={(event) => setWatermarkMatchText(event.target.value)}
                          placeholder="For example: SAMPLE"
                          className="mt-1.5 w-full rounded-lg border border-ui-strong bg-surface px-3 py-2.5 text-sm font-normal text-ink-primary outline-none focus:border-action focus:ring-2 focus:ring-action-subtle"
                        />
                      </label>
                    )}
                    <label className="block text-xs font-semibold text-ink-secondary">
                      Pages to clean (optional)
                      <input
                        value={watermarkPages}
                        onChange={(event) => setWatermarkPages(event.target.value)}
                        placeholder="All pages, or e.g. 1, 3-5"
                        className="mt-1.5 w-full rounded-lg border border-ui-strong bg-surface px-3 py-2.5 text-sm font-normal text-ink-primary outline-none focus:border-action focus:ring-2 focus:ring-action-subtle"
                      />
                      <span className="mt-1 block text-[11px] font-normal text-ink-muted">
                        Leave blank to check every page.
                      </span>
                    </label>
                    <label className="flex items-center justify-between gap-3 text-xs font-semibold text-ink-secondary">
                      Cover color
                      <input
                        type="color"
                        value={watermarkRemovalFillColor}
                        onChange={(event) => setWatermarkRemovalFillColor(event.target.value)}
                        aria-label="Watermark removal cover color"
                        className="h-9 w-14 cursor-pointer rounded-md border border-ui bg-surface p-1"
                      />
                    </label>
                    {watermarkRemovalMode === "flattened-region" && files.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold text-ink-secondary">
                          Drag to select watermark area on page 1
                        </p>
                        {watermarkRemovalPreviewLoading ? (
                          <div className="flex min-h-40 items-center justify-center rounded-xl border border-ui bg-surface-muted text-xs text-ink-muted">
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                            Rendering page preview…
                          </div>
                        ) : watermarkRemovalPreviewError ? (
                          <p role="alert" className="rounded-lg bg-danger-subtle px-3 py-2 text-xs text-danger">
                            {watermarkRemovalPreviewError}
                          </p>
                        ) : watermarkRemovalPreview ? (
                          <div
                            role="application"
                            aria-label="Select the watermark area by dragging"
                            onPointerDown={startWatermarkRegion}
                            onPointerMove={moveWatermarkRegion}
                            onPointerUp={finishWatermarkRegion}
                            onPointerCancel={finishWatermarkRegion}
                            className="relative mx-auto w-fit max-w-full touch-none cursor-crosshair overflow-hidden rounded-lg border border-ui bg-surface-muted"
                          >
                            <img
                              src={watermarkRemovalPreview}
                              alt="First PDF page. Drag over the watermark to select the area to cover."
                              className="pointer-events-none block max-h-[34rem] max-w-full select-none object-contain"
                              draggable={false}
                            />
                            {watermarkRemovalRegion && (
                              <span
                                aria-hidden="true"
                                className="pointer-events-none absolute border-2 border-danger bg-danger/20"
                                style={{
                                  left: `${watermarkRemovalRegion.x * 100}%`,
                                  top: `${watermarkRemovalRegion.y * 100}%`,
                                  width: `${watermarkRemovalRegion.width * 100}%`,
                                  height: `${watermarkRemovalRegion.height * 100}%`,
                                }}
                              />
                            )}
                          </div>
                        ) : null}
                        {watermarkRemovalRegion && (
                          <button
                            type="button"
                            onClick={() => {
                              setWatermarkRemovalRegion(null);
                              setReadyOutputs([]);
                            }}
                            className="mt-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-action hover:bg-action-subtle"
                          >
                            Clear selection
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

          </div>
        </section>

        <aside className="min-h-0 overflow-y-auto rounded-2xl border border-ui bg-surface p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-ink-primary">Settings</h2>
              <p className="mt-1 text-xs text-ink-muted">
                Options for {selectedOperation.title.toLowerCase()}.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {operation === "add-watermark" && (
              <div className="space-y-4">
                <label className="block text-xs font-semibold text-ink-secondary">
                  Watermark type
                  <select
                    value={watermarkType}
                    onChange={(event) => setWatermarkType(event.target.value as "text" | "image")}
                    className="mt-1.5 w-full rounded-lg border border-ui-strong bg-surface px-3 py-2.5 text-sm font-normal text-ink-primary outline-none focus:border-action focus:ring-2 focus:ring-action-subtle"
                  >
                    <option value="text">Text</option>
                    <option value="image">Image or logo</option>
                  </select>
                </label>
                {watermarkType === "text" ? (
                  <>
                    <label className="block text-xs font-semibold text-ink-secondary">
                      Watermark text
                      <input
                        value={watermarkText}
                        maxLength={100}
                        onChange={(event) => setWatermarkText(event.target.value)}
                        placeholder="For example: COPY"
                        className="mt-1.5 w-full rounded-lg border border-ui-strong bg-surface px-3 py-2.5 text-sm font-normal text-ink-primary outline-none focus:border-action focus:ring-2 focus:ring-action-subtle"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-xs font-semibold text-ink-secondary">
                      Text color
                      <input
                        type="color"
                        value={watermarkColor}
                        onChange={(event) => setWatermarkColor(event.target.value)}
                        aria-label="Watermark text color"
                        className="h-9 w-14 cursor-pointer rounded-md border border-ui bg-surface p-1"
                      />
                    </label>
                  </>
                ) : (
                  <label className="block text-xs font-semibold text-ink-secondary">
                    PNG or JPEG logo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                      onChange={(event) => {
                        const selected = event.currentTarget.files?.[0] ?? null;
                        if (
                          selected &&
                          !["image/png", "image/jpeg"].includes(selected.type) &&
                          !/\.(png|jpe?g)$/i.test(selected.name)
                        ) {
                          setWatermarkImage(null);
                          setError("Choose a PNG or JPEG watermark image.");
                          return;
                        }
                        setWatermarkImage(selected);
                        setError("");
                        setReadyOutputs([]);
                      }}
                      className="mt-1.5 block w-full text-xs text-ink-secondary file:mr-2 file:rounded-lg file:border-0 file:bg-action-subtle file:px-3 file:py-2 file:text-xs file:font-semibold file:text-action"
                    />
                    {watermarkImage && (
                      <span className="mt-1 block truncate text-[11px] font-normal text-ink-muted">
                        {watermarkImage.name}
                      </span>
                    )}
                  </label>
                )}
                <label className="block text-xs font-semibold text-ink-secondary">
                  Position
                  <select
                    value={watermarkPosition}
                    onChange={(event) => setWatermarkPosition(event.target.value as PdfWatermarkPosition)}
                    className="mt-1.5 w-full rounded-lg border border-ui-strong bg-surface px-3 py-2.5 text-sm font-normal text-ink-primary outline-none focus:border-action focus:ring-2 focus:ring-action-subtle"
                  >
                    <option value="diagonal">Diagonal center</option>
                    <option value="center">Center</option>
                    <option value="top-left">Top left</option>
                    <option value="top-right">Top right</option>
                    <option value="bottom-left">Bottom left</option>
                    <option value="bottom-right">Bottom right</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold text-ink-secondary">
                  Size <span className="text-action">{watermarkSize}%</span>
                  <input
                    type="range"
                    min={10}
                    max={80}
                    value={watermarkSize}
                    onChange={(event) => setWatermarkSize(Number(event.target.value))}
                    className="mt-3 block w-full accent-action-emphasis"
                  />
                </label>
                <label className="block text-xs font-semibold text-ink-secondary">
                  Rotation <span className="text-action">{watermarkRotation}°</span>
                  <input
                    type="range"
                    min={-90}
                    max={90}
                    value={watermarkRotation}
                    onChange={(event) => setWatermarkRotation(Number(event.target.value))}
                    className="mt-3 block w-full accent-action-emphasis"
                  />
                </label>
                <label className="block text-xs font-semibold text-ink-secondary">
                  Opacity <span className="text-action">{Math.round(watermarkOpacity * 100)}%</span>
                  <input
                    type="range"
                    min={5}
                    max={80}
                    value={Math.round(watermarkOpacity * 100)}
                    onChange={(event) => setWatermarkOpacity(Number(event.target.value) / 100)}
                    className="mt-3 block w-full accent-action-emphasis"
                  />
                  <span className="mt-1 block text-[11px] font-normal leading-4 text-ink-muted">
                    Adjust how strongly the watermark appears on the page.
                  </span>
                </label>
                <label className="block text-xs font-semibold text-ink-secondary">
                  Pages (optional)
                  <input
                    value={watermarkPages}
                    onChange={(event) => setWatermarkPages(event.target.value)}
                    placeholder="All pages, or e.g. 1, 3-5"
                    className="mt-1.5 w-full rounded-lg border border-ui-strong bg-surface px-3 py-2.5 text-sm font-normal text-ink-primary outline-none focus:border-action focus:ring-2 focus:ring-action-subtle"
                  />
                  <span className="mt-1.5 block text-[11px] font-normal leading-4 text-ink-muted">
                    Leave blank to watermark every page.
                  </span>
                </label>
              </div>
            )}

            {operation === "split" && (
              <label className="block text-xs font-semibold text-ink-secondary">
                Page ranges
                <input
                  value={pageRanges}
                  onChange={(event) => setPageRanges(event.target.value)}
                  placeholder="For example: 1-3, 4-6"
                  className="mt-1.5 w-full rounded-lg border border-ui-strong bg-surface px-3 py-2.5 text-sm font-normal text-ink-primary outline-none focus:border-action focus:ring-2 focus:ring-action-subtle"
                />
                <span className="mt-1.5 block text-[11px] font-normal leading-4 text-ink-muted">
                  Each comma-separated range becomes a separate PDF.
                </span>
              </label>
            )}

            {operation === "organize" && (
              <label className="block text-xs font-semibold text-ink-secondary">
                New page order
                <input
                  value={pageOrder}
                  onChange={(event) => setPageOrder(event.target.value)}
                  placeholder="For example: 3, 1, 2"
                  className="mt-1.5 w-full rounded-lg border border-ui-strong bg-surface px-3 py-2.5 text-sm font-normal text-ink-primary outline-none focus:border-action focus:ring-2 focus:ring-action-subtle"
                />
                <span className="mt-1.5 block text-[11px] font-normal leading-4 text-ink-muted">
                  Enter every page number exactly once, in the desired order.
                </span>
              </label>
            )}

            {operation === "rotate" && (
              <label className="block text-xs font-semibold text-ink-secondary">
                Rotation
                <select
                  value={rotation}
                  onChange={(event) => setRotation(Number(event.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-ui-strong bg-surface px-3 py-2.5 text-sm font-normal text-ink-primary outline-none focus:border-action focus:ring-2 focus:ring-action-subtle"
                >
                  <option value={90}>90° clockwise</option>
                  <option value={180}>180°</option>
                  <option value={270}>270° clockwise</option>
                </select>
              </label>
            )}

            {operation === "crop" && (
              <label className="block text-xs font-semibold text-ink-secondary">
                Crop margin <span className="text-action">{cropMargin}%</span>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={cropMargin}
                  onChange={(event) => setCropMargin(Number(event.target.value))}
                  className="mt-3 block w-full accent-action-emphasis"
                />
                <span className="mt-1 block text-[11px] font-normal leading-4 text-ink-muted">
                  Crops the same percentage from each edge.
                </span>
              </label>
            )}

            {operation === "compress" && (
              <label className="block text-xs font-semibold text-ink-secondary">
                Image quality <span className="text-action">{quality}%</span>
                <input
                  type="range"
                  min={20}
                  max={95}
                  value={quality}
                  onChange={(event) => setQuality(Number(event.target.value))}
                  className="mt-3 block w-full accent-action-emphasis"
                />
                <span className="mt-1 block text-[11px] font-normal leading-4 text-ink-muted">
                  Lower quality usually makes a smaller file.
                </span>
                <span className="mt-2 block rounded-lg border border-warning-border bg-warning-subtle px-2.5 py-2 text-[11px] font-normal leading-4 text-warning-strong">
                  Pages are converted to images; selectable text and forms are not preserved.
                </span>
              </label>
            )}

            {isPasswordOperation(operation) && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-ink-secondary">
                  {operation === "protect" ? "New password" : "PDF password"}
                  <input
                    type="password"
                    autoComplete={operation === "protect" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-ui-strong bg-surface px-3 py-2.5 text-sm font-normal text-ink-primary outline-none focus:border-action focus:ring-2 focus:ring-action-subtle"
                  />
                </label>
                {operation === "protect" && (
                  <>
                    <label className="block text-xs font-semibold text-ink-secondary">
                      Confirm password
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={passwordConfirm}
                        onChange={(event) => setPasswordConfirm(event.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-ui-strong bg-surface px-3 py-2.5 text-sm font-normal text-ink-primary outline-none focus:border-action focus:ring-2 focus:ring-action-subtle"
                      />
                    </label>
                    <p className="text-[11px] leading-4 text-ink-muted">
                      AES-256 encryption is used. This password cannot be recovered.
                    </p>
                  </>
                )}
                {passwordMismatch && (
                  <p className="text-xs text-danger">The passwords do not match.</p>
                )}
              </div>
            )}

            {["merge", "image-to-pdf", "pdf-to-image", "page-numbers"].includes(operation) && (
              <div className="rounded-xl bg-surface-muted px-3 py-3 text-xs leading-5 text-ink-muted">
                {operation === "merge"
                  ? "Reorder the selected files in the workspace before merging."
                  : operation === "image-to-pdf"
                    ? "Each image will be placed on its own PDF page."
                    : operation === "pdf-to-image"
                      ? "Each PDF page is exported as a separate PNG."
                      : "Numbers are added in the format page / total pages."}
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-lg border border-danger-border bg-danger-subtle px-3 py-2.5 text-xs leading-5 text-danger">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void process()}
            disabled={!canProcess}
            className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
              canProcess
                ? "bg-action text-ink-inverse hover:bg-action-hover"
                : "cursor-not-allowed bg-ui text-ink-faint"
            }`}
          >
            {isProcessing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <selectedOperation.Icon className="h-4 w-4" aria-hidden="true" />
            )}
            {isProcessing ? "Working…" : selectedOperation.title}
          </button>

          {readyOutputs.length > 0 && (
            <section className="mt-4 border-t border-ui-subtle pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
                Ready to download
              </h3>
              <ul className="space-y-2" aria-label="PDF outputs">
                {readyOutputs.map((output) => (
                  <li key={output.filename}>
                    <button
                      type="button"
                      onClick={() => downloadPdfOutput(output.bytes, output.filename)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-action-border bg-action-subtle px-2.5 py-2 text-left text-xs font-semibold text-action transition-colors hover:bg-action-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
                    >
                      <span className="min-w-0 truncate">{output.filename}</span>
                      <ArrowDownToLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </main>
    {previewSelection && (
      <FilePreviewDialog
        selection={previewSelection}
        onClose={closePreview}
        onPageChange={changePreviewPage}
      />
    )}
    </>
  );
}
