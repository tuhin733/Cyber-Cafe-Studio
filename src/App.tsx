import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CheckCircle2,
  ChevronDown,
  Crop,
  Eraser,
  FileArchive,
  FileImage,
  Files,
  FileText,
  FileLock2,
  Github,
  Hash,
  Heart,
  Image,
  ImageMinus,
  ListOrdered,
  LockKeyholeOpen,
  Minus,
  Newspaper,
  PenLine,
  RefreshCw,
  RotateCw,
  Scaling,
  Scissors,
  Square,
  SquareUserRound,
  Stamp,
  Trash2,
  Copy,
  X,
  type LucideIcon,
} from "lucide-react";
import { DOC_CATEGORIES } from "./constants";
import { paginate } from "./lib/pagination";
import { prepareDocumentPrintPages } from "./lib/documentPrint";
import { notifyUserError } from "./lib/userErrors";
import { USER_SUCCESS_EVENT } from "./lib/userNotifications";
import { useProjectState } from "./hooks/useProjectState";
import UploadZone from "./components/UploadZone";
import ToolHome from "./components/ToolHome";
import BackToToolsButton from "./components/BackToToolsButton";
import ErrorPopup from "./components/ErrorPopup";
import DocTray from "./components/DocTray";
import A4Page from "./components/A4Page";
import ControlPanel from "./components/ControlPanel";
import ImageEditor from "./components/ImageEditor";
import PdfExportDialog from "./components/PdfExportDialog";
import DocumentPrintDialog from "./components/DocumentPrintDialog";
import AboutDialog from "./components/AboutDialog";
import DonationDialog from "./components/DonationDialog";
import UpdateDialog from "./components/UpdateDialog";
import type { UpdateStatus } from "./types";
import type { ImageToolMode } from "./components/ImageTools";
import type { PdfOperation } from "./components/PdfTools";

const PassportPhotoMaker = lazy(
  () => import("./components/PassportPhotoMaker"),
);
const PhotoSignatureMaker = lazy(
  () => import("./components/PhotoSignatureMaker"),
);
const PhotoBackgroundRemover = lazy(
  () => import("./components/PhotoBackgroundRemover"),
);
const IMAGE_TOOL_SCREENS = {
  resize: lazy(() => import("./components/ImageResizer")),
  crop: lazy(() => import("./components/ImageCropper")),
  compress: lazy(() => import("./components/ImageCompressor")),
  convert: lazy(() => import("./components/ImageConverter")),
};
const PDF_TOOL_SCREENS = {
  merge: lazy(() => import("./components/PdfMerger")),
  split: lazy(() => import("./components/PdfSplitter")),
  organize: lazy(() => import("./components/PdfPageOrganizer")),
  "delete-pages": lazy(() => import("./components/PdfPageDeleter")),
  "image-to-pdf": lazy(() => import("./components/ImageToPdf")),
  "pdf-to-image": lazy(() => import("./components/PdfToImage")),
  compress: lazy(() => import("./components/PdfCompressor")),
  rotate: lazy(() => import("./components/PdfRotator")),
  crop: lazy(() => import("./components/PdfCropper")),
  "page-numbers": lazy(() => import("./components/PdfPageNumbering")),
  "add-watermark": lazy(() => import("./components/PdfWatermarkAdder")),
  "remove-watermark": lazy(() => import("./components/PdfWatermarkRemover")),
  protect: lazy(() => import("./components/PdfProtector")),
  unlock: lazy(() => import("./components/PdfUnlocker")),
};
const DocumentMaker = lazy(() => import("./components/DocumentMaker"));
const BiodataResumeMaker = lazy(
  () => import("./components/BiodataResumeMaker"),
);

interface ToolMenuEntry {
  label: string;
  Icon: LucideIcon;
  onSelect: () => void;
  active: boolean;
}

function App() {
  const {
    docs,
    blankPageCount,
    settings,
    busy,
    arrangeMode,
    defaultCategory,
    editingDocId,
    showPdfExportDialog,
    autoSaveStatus,
    autoSaveLastSavedAt,
    retryAutoSave,
    setArrangeMode,
    setDefaultCategory,
    setEditingDocId,
    addFiles,
    addPage,
    addPageAfter,
    duplicatePage,
    movePage,
    deletePage,
    removeDoc,
    duplicateDoc,
    reorderDoc,
    changeLabel,
    changeDocumentSize,
    changePlacement,
    resetPlacements,
    editDoc,
    handleEditSave,
    handleApplyEditToAll,
    updateSettings,
    clearAllDocs,
    handleExport,
    handleExportPDF,
    cancelPdfExport,
  } = useProjectState();

  const [isMaximized, setIsMaximized] = useState(false);
  const [isHomeScreen, setIsHomeScreen] = useState(true);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [showDocumentPrintDialog, setShowDocumentPrintDialog] = useState(false);
  const [showDonationDialog, setShowDonationDialog] = useState(false);
  const [showPassportPhotoMaker, setShowPassportPhotoMaker] = useState(false);
  const [showPhotoSignatureMaker, setShowPhotoSignatureMaker] = useState(false);
  const [showPhotoBackgroundRemover, setShowPhotoBackgroundRemover] = useState(false);
  const [showImageTools, setShowImageTools] = useState(false);
  const [showPdfTools, setShowPdfTools] = useState(false);
  const [initialImageToolMode, setInitialImageToolMode] = useState<ImageToolMode | undefined>();
  const [initialPdfOperation, setInitialPdfOperation] = useState<PdfOperation | undefined>();
  const [showDocumentMaker, setShowDocumentMaker] = useState(false);
  const [showBiodataResumeMaker, setShowBiodataResumeMaker] = useState(false);
  const [passportPhoto, setPassportPhoto] = useState<File | null>(null);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const [isUpdateDialogDismissed, setIsUpdateDialogDismissed] = useState(false);
  const [updateDownloadState, setUpdateDownloadState] = useState<
    "idle" | "downloading" | "installing" | "error"
  >("idle");
  const [updateProgress, setUpdateProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    state: "checking",
  });
  const [successToast, setSuccessToast] = useState<{
    id: number;
    message: string;
  } | null>(null);
  const toastIdRef = useRef(0);
  const desktopAPI = window.desktopAPI;
  const ActiveImageTool = IMAGE_TOOL_SCREENS[initialImageToolMode ?? "resize"];
  const ActivePdfTool = PDF_TOOL_SCREENS[initialPdfOperation ?? "merge"];

  const openDocumentEditor = () => {
    setIsHomeScreen(false);
    setShowDocumentMaker(false);
    setShowBiodataResumeMaker(false);
    setShowPassportPhotoMaker(false);
    setShowPhotoSignatureMaker(false);
    setShowPhotoBackgroundRemover(false);
    setShowImageTools(false);
    setShowPdfTools(false);
  };

  const openPassportPhotoMaker = () => {
    setIsHomeScreen(false);
    setShowDocumentMaker(false);
    setShowBiodataResumeMaker(false);
    setShowPassportPhotoMaker(true);
    setShowPhotoSignatureMaker(false);
    setShowPhotoBackgroundRemover(false);
    setShowImageTools(false);
    setShowPdfTools(false);
  };

  const openPhotoSignatureMaker = () => {
    setIsHomeScreen(false);
    setShowDocumentMaker(false);
    setShowBiodataResumeMaker(false);
    setShowPassportPhotoMaker(false);
    setShowPhotoSignatureMaker(true);
    setShowPhotoBackgroundRemover(false);
    setShowImageTools(false);
    setShowPdfTools(false);
  };

  const openBackgroundRemover = () => {
    setIsHomeScreen(false);
    setShowDocumentMaker(false);
    setShowBiodataResumeMaker(false);
    setShowPhotoBackgroundRemover(true);
    setShowPassportPhotoMaker(false);
    setShowPhotoSignatureMaker(false);
    setShowImageTools(false);
    setShowPdfTools(false);
  };

  const openImageTools = (mode?: ImageToolMode) => {
    setIsHomeScreen(false);
    setShowDocumentMaker(false);
    setShowBiodataResumeMaker(false);
    setShowPassportPhotoMaker(false);
    setShowPhotoSignatureMaker(false);
    setShowPhotoBackgroundRemover(false);
    setShowImageTools(true);
    setShowPdfTools(false);
    setInitialImageToolMode(mode);
  };

  const openPdfTools = (operation?: PdfOperation) => {
    setIsHomeScreen(false);
    setShowDocumentMaker(false);
    setShowBiodataResumeMaker(false);
    setShowPassportPhotoMaker(false);
    setShowPhotoSignatureMaker(false);
    setShowPhotoBackgroundRemover(false);
    setShowImageTools(false);
    setShowPdfTools(true);
    setInitialPdfOperation(operation);
  };

  const openDocumentMaker = () => {
    setIsHomeScreen(false);
    setShowDocumentMaker(true);
    setShowBiodataResumeMaker(false);
    setShowPassportPhotoMaker(false);
    setShowPhotoSignatureMaker(false);
    setShowPhotoBackgroundRemover(false);
    setShowImageTools(false);
    setShowPdfTools(false);
  };

  const openBiodataResumeMaker = () => {
    setIsHomeScreen(false);
    setShowDocumentMaker(false);
    setShowBiodataResumeMaker(true);
    setShowPassportPhotoMaker(false);
    setShowPhotoSignatureMaker(false);
    setShowPhotoBackgroundRemover(false);
    setShowImageTools(false);
    setShowPdfTools(false);
  };

  const toolMenuGroups: { title: string; tools: ToolMenuEntry[] }[] = [
    {
      title: "Workspace",
      tools: [
        {
          label: "Doc Stitch",
          Icon: FileText,
          onSelect: openDocumentEditor,
          active: !isHomeScreen && !showDocumentMaker && !showPassportPhotoMaker &&
            !showBiodataResumeMaker && !showPhotoSignatureMaker && !showPhotoBackgroundRemover &&
            !showImageTools && !showPdfTools,
        },
        {
          label: "Document Maker",
          Icon: FileText,
          onSelect: openDocumentMaker,
          active: showDocumentMaker,
        },
        {
          label: "Biodata & Resume Maker",
          Icon: FileText,
          onSelect: openBiodataResumeMaker,
          active: showBiodataResumeMaker,
        },
      ],
    },
    {
      title: "Image tools",
      tools: [
        { label: "Photo & Signature Resizer", Icon: Scaling, onSelect: () => openImageTools("resize"), active: showImageTools && initialImageToolMode === "resize" },
        { label: "Photo + Signature / Name & Date", Icon: PenLine, onSelect: openPhotoSignatureMaker, active: showPhotoSignatureMaker },
        { label: "Image Cropper", Icon: Crop, onSelect: () => openImageTools("crop"), active: showImageTools && initialImageToolMode === "crop" },
        { label: "Image Compressor", Icon: FileArchive, onSelect: () => openImageTools("compress"), active: showImageTools && initialImageToolMode === "compress" },
        { label: "Image Converter", Icon: RefreshCw, onSelect: () => openImageTools("convert"), active: showImageTools && initialImageToolMode === "convert" },
      ],
    },
    {
      title: "PDF tools",
      tools: [
        { label: "Merge PDF", Icon: Files, onSelect: () => openPdfTools("merge"), active: showPdfTools && initialPdfOperation === "merge" },
        { label: "Split PDF", Icon: Scissors, onSelect: () => openPdfTools("split"), active: showPdfTools && initialPdfOperation === "split" },
        { label: "Organize Pages", Icon: ListOrdered, onSelect: () => openPdfTools("organize"), active: showPdfTools && initialPdfOperation === "organize" },
        { label: "Delete Pages", Icon: Trash2, onSelect: () => openPdfTools("delete-pages"), active: showPdfTools && initialPdfOperation === "delete-pages" },
        { label: "Image to PDF", Icon: Image, onSelect: () => openPdfTools("image-to-pdf"), active: showPdfTools && initialPdfOperation === "image-to-pdf" },
        { label: "PDF to Image", Icon: FileImage, onSelect: () => openPdfTools("pdf-to-image"), active: showPdfTools && initialPdfOperation === "pdf-to-image" },
        { label: "Compress PDF", Icon: FileArchive, onSelect: () => openPdfTools("compress"), active: showPdfTools && initialPdfOperation === "compress" },
        { label: "Rotate PDF", Icon: RotateCw, onSelect: () => openPdfTools("rotate"), active: showPdfTools && initialPdfOperation === "rotate" },
        { label: "Crop PDF", Icon: Crop, onSelect: () => openPdfTools("crop"), active: showPdfTools && initialPdfOperation === "crop" },
        { label: "Page Numbers", Icon: Hash, onSelect: () => openPdfTools("page-numbers"), active: showPdfTools && initialPdfOperation === "page-numbers" },
        { label: "Add Watermark", Icon: Stamp, onSelect: () => openPdfTools("add-watermark"), active: showPdfTools && initialPdfOperation === "add-watermark" },
        { label: "Remove Watermark", Icon: Eraser, onSelect: () => openPdfTools("remove-watermark"), active: showPdfTools && initialPdfOperation === "remove-watermark" },
        { label: "Protect PDF", Icon: FileLock2, onSelect: () => openPdfTools("protect"), active: showPdfTools && initialPdfOperation === "protect" },
        { label: "Unlock PDF", Icon: LockKeyholeOpen, onSelect: () => openPdfTools("unlock"), active: showPdfTools && initialPdfOperation === "unlock" },
      ],
    },
    {
      title: "Photo & identity",
      tools: [
        {
          label: "Passport Photo Maker",
          Icon: SquareUserRound,
          onSelect: openPassportPhotoMaker,
          active: showPassportPhotoMaker,
        },
        {
          label: "Photo Background Remover",
          Icon: ImageMinus,
          onSelect: openBackgroundRemover,
          active: showPhotoBackgroundRemover,
        },
      ],
    },
  ];

  const returnToHome = () => {
    setIsHomeScreen(true);
    setShowDocumentMaker(false);
    setShowBiodataResumeMaker(false);
    setShowPassportPhotoMaker(false);
    setShowPhotoSignatureMaker(false);
    setShowPhotoBackgroundRemover(false);
    setShowImageTools(false);
    setShowPdfTools(false);
  };

  useEffect(() => {
    const handleSuccess = (event: Event) => {
      const message = (event as CustomEvent<unknown>).detail;
      if (typeof message !== "string" || !message.trim()) return;
      setSuccessToast({ id: ++toastIdRef.current, message: message.trim() });
    };

    window.addEventListener(USER_SUCCESS_EVENT, handleSuccess);
    return () => window.removeEventListener(USER_SUCCESS_EVENT, handleSuccess);
  }, []);

  useEffect(() => {
    if (!successToast) return;
    const timeout = window.setTimeout(() => setSuccessToast(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [successToast]);

  const handlePrintDocuments = useCallback(
    async (
      printerName: string,
      copies: number,
      pageNumbers: number[],
    ) => {
      if (!desktopAPI) {
        throw new Error("Direct printing is only available in the Windows desktop app.");
      }
      const pages = await prepareDocumentPrintPages(
        docs,
        settings,
        blankPageCount,
        pageNumbers,
      );
      await desktopAPI.printDocuments({ pages, copies, printerName });
    },
    [blankPageCount, desktopAPI, docs, settings],
  );

  const handleSendToPassportMaker = useCallback((file: File) => {
    setPassportPhoto(file);
    setIsHomeScreen(false);
    setShowPassportPhotoMaker(true);
    setShowPhotoSignatureMaker(false);
    setShowPhotoBackgroundRemover(false);
  }, []);

  const handlePassportPhotoConsumed = useCallback(() => {
    setPassportPhoto(null);
  }, []);

  const handleScan = useCallback(async () => {
    if (!desktopAPI) return;

    setIsScanning(true);
    try {
      const result = await desktopAPI.scanDocument();
      if (!result.canceled) {
        const scannedFile = new File([result.bytes], result.fileName, {
          type: "image/jpeg",
        });
        const addedDocId = await addFiles([scannedFile], activePageIndex);
        if (addedDocId) setEditingDocId(addedDocId);
      }
    } catch (error) {
      console.error("Unable to scan document", error);
      const details = error instanceof Error ? error.message : "";
      if (/did not respond within 3 minutes/i.test(details)) {
        notifyUserError(
          "The printer didn't respond. Make sure it's on and connected, then try again.",
        );
      } else if (
        /wia device|scanner.*(not found|unavailable|not ready)|device.*(not found|unavailable|not ready)/i.test(
          details,
        )
      ) {
        notifyUserError(
          "Couldn't connect to the printer. Make sure it's turned on and connected, then try again.",
        );
      } else {
        notifyUserError(
          "The scan couldn't be completed. Check that the printer is on and connected, then try again.",
        );
      }
    } finally {
      setIsScanning(false);
    }
  }, [activePageIndex, addFiles, desktopAPI, setEditingDocId]);

  const checkForUpdates = useCallback(async () => {
    if (!desktopAPI) {
      setUpdateStatus({ state: "error" });
      return;
    }

    setUpdateStatus({ state: "checking" });
    try {
      const latestRelease = await desktopAPI.checkUpdates();
      const latestVersion = latestRelease.tag.replace(/^v/, "");
      const currentParts = __APP_VERSION__.split(".").map(Number);
      const latestParts = latestVersion.split(".").map(Number);
      const hasNewerVersion =
        latestParts.length === currentParts.length &&
        latestParts.every(Number.isInteger) &&
        latestParts.some(
          (part, index) =>
            part > currentParts[index] &&
            latestParts
              .slice(0, index)
              .every((previousPart, previousIndex) =>
                previousPart === currentParts[previousIndex],
              ),
        );

      setUpdateStatus({
        state: hasNewerVersion ? "available" : "current",
        tag: latestRelease.tag,
        publishedAt: latestRelease.publishedAt,
        installerUrl: latestRelease.installerUrl,
      });
    } catch (error) {
      console.error("Unable to check for updates", error);
      setUpdateStatus({ state: "error" });
    }
  }, [desktopAPI]);

  useEffect(() => {
    if (desktopAPI) void checkForUpdates();
  }, [checkForUpdates, desktopAPI]);

  useEffect(() => {
    if (!showToolsMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !toolsMenuRef.current?.contains(event.target)
      ) {
        setShowToolsMenu(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowToolsMenu(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showToolsMenu]);

  useEffect(() => {
    if (!desktopAPI) return;

    const unsubscribeProgress = desktopAPI.onUpdateProgress((percent) => {
      setUpdateProgress(Math.max(0, Math.min(100, percent)));
    });
    const unsubscribeInstalling = desktopAPI.onUpdateInstalling(() => {
      setUpdateDownloadState("installing");
    });
    const unsubscribeError = desktopAPI.onUpdateError(() => {
      setUpdateDownloadState("error");
    });

    return () => {
      unsubscribeProgress();
      unsubscribeInstalling();
      unsubscribeError();
    };
  }, [desktopAPI]);

  useEffect(() => {
    if (!desktopAPI) return;

    let active = true;
    const unsubscribe = desktopAPI.onMaximizeChange(setIsMaximized);
    void desktopAPI
      .isMaximized()
      .then((maximized) => {
        if (active) setIsMaximized(maximized);
      })
      .catch((error: unknown) =>
        console.error("Unable to read window state", error),
      );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [desktopAPI]);

  const { pages } = useMemo(
    () => paginate(docs, settings, blankPageCount),
    [blankPageCount, docs, settings],
  );
  const pageCount = pages.length;

  useEffect(() => {
    setActivePageIndex((current) =>
      Math.min(current, Math.max(0, pageCount - 1)),
    );
  }, [pageCount]);

  const handleAddPage = () => {
    setActivePageIndex(pageCount);
    addPage();
  };

  const handleAddPageAfter = (pageIndex: number) => {
    addPageAfter(pageIndex);
    setActivePageIndex(pageIndex + 1);
  };

  const handleDuplicatePage = (pageIndex: number) => {
    duplicatePage(pageIndex);
    setActivePageIndex(pageIndex + 1);
  };

  const handleDeletePage = (pageIndex: number) => {
    if (pageIndex === 0) return;
    deletePage(pageIndex);
    setActivePageIndex((current) =>
      current > pageIndex
        ? current - 1
        : Math.max(0, Math.min(current, pageCount - 2)),
    );
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        isHomeScreen ||
        showDocumentMaker ||
        !(event.ctrlKey || event.metaKey)
      ) return;

      switch (event.key.toLowerCase()) {
        case "s":
          event.preventDefault();
          void handleExport();
          break;
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [
    handleExport,
    isHomeScreen,
    showDocumentMaker,
  ]);

  return (
    <>
      <ErrorPopup />
      <div className="screen-shell flex h-dvh flex-col overflow-hidden bg-surface-muted">
        <header className="app-titlebar sticky top-0 z-30 flex h-10 shrink-0 items-center justify-between border-b border-ui bg-surface/90 pl-3 backdrop-blur-lg">
          <div className="flex min-w-0 items-center gap-2">
            <img
              src="./cyber_cafe_studio_teal.svg"
              alt=""
              className="h-5 w-5"
              aria-hidden="true"
            />
            <h1 className="text-sm font-bold tracking-tight text-ink-primary">
              Cyber Cafe Studio
            </h1>
            <span className="shrink-0 rounded-md bg-surface-subtle px-2.5 py-1 text-[10px] font-semibold text-ink-secondary">
              v{__APP_VERSION__}
            </span>
          </div>
          <div className="flex h-full items-center">
            <div className="relative mr-2" ref={toolsMenuRef}>
              <button
                type="button"
                aria-expanded={showToolsMenu}
                aria-controls="tools-menu"
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  showToolsMenu ||
                  (!isHomeScreen &&
                    !showDocumentMaker &&
                    !showPassportPhotoMaker &&
                    !showPhotoSignatureMaker &&
                    !showPhotoBackgroundRemover &&
                    !showImageTools) ||
                  showPassportPhotoMaker ||
                  showPhotoSignatureMaker ||
                  showPhotoBackgroundRemover ||
                  showImageTools ||
                  showPdfTools ||
                  showDocumentMaker
                    ? "bg-action-emphasis text-ink-inverse"
                    : "bg-action-subtle text-action hover:bg-action-soft"
                }`}
                onClick={() => setShowToolsMenu((current) => !current)}
              >
                Tools
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${showToolsMenu ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
              {showToolsMenu && (
                <div
                  id="tools-menu"
                  role="region"
                  aria-label="Tools"
                  className="scrollbar-hidden absolute right-0 top-full z-50 mt-2 max-h-[min(80dvh,42rem)] w-[min(26rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-ui bg-surface p-2 text-left shadow-xl"
                >
                  {toolMenuGroups.map((group) => (
                    <section
                      key={group.title}
                      aria-label={group.title}
                      className="border-b border-ui-subtle px-1 py-2 last:border-b-0"
                    >
                      <h2 className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                        {group.title}
                      </h2>
                      <div className="grid grid-cols-2 gap-1">
                        {group.tools.map(({ label, Icon, onSelect, active }) => (
                          <button
                            key={label}
                            type="button"
                            aria-current={active ? "page" : undefined}
                            onClick={() => {
                              onSelect();
                              setShowToolsMenu(false);
                            }}
                            className={`flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-action ${
                              active
                                ? "bg-action-subtle text-action-hover"
                                : "text-ink-secondary hover:bg-surface-muted"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0 text-action-emphasis" aria-hidden="true" />
                            <span className="truncate text-[11px] font-semibold">{label}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}

            </div>
            <button
              type="button"
              aria-label="Donate"
              aria-haspopup="dialog"
              title="Donate"
              className="group mx-2 flex items-center gap-1.5 rounded-full bg-danger-subtle px-3 py-1 text-xs font-semibold text-danger-strong transition-colors hover:bg-danger-soft hover:text-danger"
              onClick={() => setShowDonationDialog(true)}
            >
              <Heart className="h-3.5 w-3.5 transition-all group-hover:fill-current" aria-hidden="true" />
              Donate
            </button>
            <a
              href="https://github.com/tuhin733/cyber-cafe-studio"
              target="_blank"
              rel="noreferrer"
              aria-label="Open the Cyber Cafe Studio project repository on GitHub"
              title="Open project repository"
              className="group flex h-full w-10 items-center justify-center text-ink-muted"
              onClick={(event) => {
                if (!desktopAPI) return;
                event.preventDefault();
                void desktopAPI
                  .openRepository()
                  .catch((error: unknown) => {
                    console.error("Unable to open project repository", error);
                    notifyUserError(
                      "Couldn't open the Cyber Cafe Studio repository. Check your internet connection and try again.",
                    );
                  });
              }}
            >
              <Github
                className="h-4 w-4 transition-colors group-hover:text-ink-primary"
                aria-hidden="true"
              />
            </a>
            <button
              type="button"
              aria-label="About Cyber Cafe Studio"
              aria-haspopup="dialog"
              title="About Cyber Cafe Studio"
              className="group flex h-full w-10 items-center justify-center text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink-primary"
              onClick={() => setShowAboutDialog(true)}
            >
              <Newspaper className="h-4 w-4" aria-hidden="true" />
            </button>
            {desktopAPI && (
              <div className="app-window-controls flex h-full">
                <button
                  type="button"
                  aria-label="Minimize window"
                  title="Minimize"
                  onClick={() => void desktopAPI.minimize()}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={isMaximized ? "Restore window" : "Maximize window"}
                  title={isMaximized ? "Restore" : "Maximize"}
                  onClick={() => void desktopAPI.toggleMaximize()}
                >
                  {isMaximized ? (
                    <Copy className="h-3.5 w-3.5" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  className="close-control"
                  aria-label="Close window"
                  title="Close"
                  onClick={() => void desktopAPI.close()}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </header>

        {isHomeScreen ? (
          <ToolHome
            onOpenDocumentEditor={openDocumentEditor}
            onOpenDocumentMaker={openDocumentMaker}
            onOpenBiodataResumeMaker={openBiodataResumeMaker}
            onOpenPassportPhotoMaker={openPassportPhotoMaker}
            onOpenPhotoSignatureMaker={openPhotoSignatureMaker}
            onOpenBackgroundRemover={openBackgroundRemover}
            onOpenImageTool={openImageTools}
            onOpenPdfTool={openPdfTools}
          />
        ) : showDocumentMaker ? (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center bg-surface-muted text-sm font-medium text-ink-muted">
                Loading Document Maker…
              </div>
            }
          >
            <DocumentMaker onClose={returnToHome} />
          </Suspense>
        ) : showBiodataResumeMaker ? (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center bg-surface-muted text-sm font-medium text-ink-muted">
                Loading Biodata & Resume Maker…
              </div>
            }
          >
            <BiodataResumeMaker onClose={returnToHome} />
          </Suspense>
        ) : showPassportPhotoMaker ? (
          <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center bg-surface-muted text-sm font-medium text-ink-muted">
                  Loading photo tools…
                </div>
              }
            >
              <PassportPhotoMaker
                onClose={returnToHome}
                initialPhoto={passportPhoto}
                onInitialPhotoConsumed={handlePassportPhotoConsumed}
              />
            </Suspense>
          </main>
        ) : showPhotoSignatureMaker ? (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center bg-surface-muted text-sm font-medium text-ink-muted">
                Loading Photo + Signature tool…
              </div>
            }
          >
            <PhotoSignatureMaker onClose={returnToHome} />
          </Suspense>
        ) : showImageTools ? (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center bg-surface-muted text-sm font-medium text-ink-muted">
                Loading Image Tools…
              </div>
            }
          >
            <ActiveImageTool onClose={returnToHome} />
          </Suspense>
        ) : showPdfTools ? (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center bg-surface-muted text-sm font-medium text-ink-muted">
                Loading PDF Tools…
              </div>
            }
          >
            <ActivePdfTool onClose={returnToHome} />
          </Suspense>
        ) : showPhotoBackgroundRemover ? (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center bg-surface-muted text-sm font-medium text-ink-muted">
                Loading background remover…
              </div>
            }
          >
            <PhotoBackgroundRemover
              onClose={returnToHome}
              onSendToPassportMaker={handleSendToPassportMaker}
            />
          </Suspense>
        ) : (
          <>
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {isScanning && (
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-success-soft"
              role="progressbar"
              aria-label="Scanning document"
              aria-valuetext="Scan in progress"
            >
              <div className="scan-progress-indicator h-full w-1/3 bg-success-progress" />
            </div>
          )}
          <div className="min-h-0 w-full max-w-7xl flex-1 self-center px-3 sm:px-4">
            <div className="grid h-full min-h-0 grid-cols-1 items-stretch gap-4 min-[900px]:grid-cols-[260px_minmax(0,1fr)_240px] lg:grid-cols-[300px_minmax(0,1fr)_260px]">
              <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden py-3">
                <BackToToolsButton onClick={returnToHome} toolName="Doc Stitch" />
                <div>
                  <label className="text-sm font-bold text-ink-strong pb-1 block" htmlFor="default-category">
                    Document type
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.values(DOC_CATEGORIES).map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        aria-pressed={defaultCategory === category.id}
                        onClick={() => setDefaultCategory(category.id)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${
                          defaultCategory === category.id
                            ? "text-ink-inverse shadow-sm"
                            : "bg-surface text-ink-muted ring-1 ring-ui hover:bg-surface-muted"
                        }`}
                        style={
                          defaultCategory === category.id
                            ? { background: category.accent }
                            : undefined
                        }
                      >
                        {category.label}
                      </button>
                    ))}
                  </div>
                </div>

                <UploadZone
                  onFiles={(files) => addFiles(files, activePageIndex)}
                  onScan={desktopAPI ? () => void handleScan() : undefined}
                  isScanning={isScanning}
                  documentMode={defaultCategory === "document"}
                />

                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-ink-strong">
                      Documents{" "}
                      <span className="ml-1 rounded-full bg-surface-subtle px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">
                        {docs.length}
                      </span>
                    </h2>
                    {docs.length > 0 && (
                      <button
                        type="button"
                        onClick={clearAllDocs}
                        className="text-xs font-medium text-error-outline hover:text-error-hover"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  <DocTray
                    docs={docs}
                    onRemove={removeDoc}
                    onDuplicate={duplicateDoc}
                    onReorder={reorderDoc}
                    onLabelChange={changeLabel}
                    onDocumentSizeChange={changeDocumentSize}
                    onEdit={editDoc}
                  />
                </div>
              </div>

              <div className="relative h-full min-h-0 min-w-0 overflow-hidden">
                <A4Page
                  docs={docs}
                  settings={settings}
                  blankPageCount={blankPageCount}
                  onPlacementChange={changePlacement}
                  arrangeMode={arrangeMode}
                  onAddPage={handleAddPage}
                  onAddPageAfter={handleAddPageAfter}
                  onDuplicatePage={handleDuplicatePage}
                  onDeletePage={handleDeletePage}
                  onMovePage={movePage}
                  activePageIndex={activePageIndex}
                  onPageSelect={setActivePageIndex}
                />
              </div>

              <div className="min-h-0 self-start pt-6">
                <div className="max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-2xl border border-ui bg-surface px-4 pb-3 pt-6 shadow-sm">
                  <ControlPanel
                    settings={settings}
                    onChange={updateSettings}
                    documentMode={defaultCategory === "document"}
                    onExport={handleExport}
                    busy={busy}
                    cardCount={docs.length}
                    pageCount={pageCount}
                    arrangeMode={arrangeMode}
                    onArrangeModeChange={setArrangeMode}
                    onResetPlacements={resetPlacements}
                    autoSaveStatus={autoSaveStatus}
                    autoSaveLastSavedAt={autoSaveLastSavedAt}
                    onRetryAutoSave={retryAutoSave}
                    onPrint={
                      desktopAPI
                        ? () => setShowDocumentPrintDialog(true)
                        : undefined
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </main>
          </>
        )}
      </div>

      {successToast && (
        <div
          className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-xl bg-success-accent px-4 py-3 text-sm font-semibold text-ink-inverse shadow-lg"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2 className="h-5 w-5 text-ink-inverse" aria-hidden="true" />
          {successToast.message}
        </div>
      )}

      {editingDocId && (
        <ImageEditor
          key={editingDocId}
          docs={docs}
          doc={docs.find((doc) => doc.id === editingDocId)!}
          onSave={handleEditSave}
          onSelectDoc={setEditingDocId}
          onApplyToAll={handleApplyEditToAll}
          onClose={() => setEditingDocId(null)}
        />
      )}

      {showPdfExportDialog && (
        <PdfExportDialog
          docs={docs}
          settings={settings}
          blankPageCount={blankPageCount}
          onExport={handleExportPDF}
          onCancel={cancelPdfExport}
        />
      )}

      {showDocumentPrintDialog && desktopAPI && (
        <DocumentPrintDialog
          pageCount={pageCount}
          onPrint={handlePrintDocuments}
          onClose={() => setShowDocumentPrintDialog(false)}
        />
      )}

      {showAboutDialog && (
        <AboutDialog
          onClose={() => setShowAboutDialog(false)}
        />
      )}

      {showDonationDialog && (
        <DonationDialog onClose={() => setShowDonationDialog(false)} />
      )}

      {updateStatus.state === "available" && !isUpdateDialogDismissed && (
        <UpdateDialog
          version={updateStatus.tag}
          downloadState={updateDownloadState}
          progress={updateProgress}
          installerUrl={updateStatus.installerUrl}
          onManualDownload={() => {
            if (!desktopAPI || !updateStatus.installerUrl) return;
            void desktopAPI
              .openInstallerDownload(updateStatus.installerUrl)
              .catch((error: unknown) => {
                console.error("Unable to open installer download", error);
                notifyUserError(
                  "Couldn't open the installer download. Check your internet connection and try again.",
                );
              });
          }}
          onUpdate={() => {
            if (
              updateStatus.state !== "available" ||
              updateDownloadState === "downloading" ||
              updateDownloadState === "installing"
            ) {
              return;
            }
            if (!desktopAPI) {
              setUpdateDownloadState("error");
              notifyUserError(
                "In-app updates are only available in the installed desktop app.",
              );
              return;
            }
            setUpdateDownloadState("downloading");
            setUpdateProgress(0);
            void desktopAPI
              .downloadUpdate(updateStatus.tag)
              .then(() => setUpdateDownloadState("installing"))
              .catch((error: unknown) => {
                console.error("Unable to install update", error);
                setUpdateDownloadState("error");
              });
          }}
          onLater={() => setIsUpdateDialogDismissed(true)}
        />
      )}
    </>
  );
}

export default App;
