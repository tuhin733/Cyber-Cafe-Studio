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
  FileText,
  FileStack,
  Github,
  Heart,
  Image,
  ImageMinus,
  Minus,
  Newspaper,
  Square,
  SquareUserRound,
  Copy,
  X,
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

const PassportPhotoMaker = lazy(
  () => import("./components/PassportPhotoMaker"),
);
const PhotoBackgroundRemover = lazy(
  () => import("./components/PhotoBackgroundRemover"),
);
const ImageTools = lazy(() => import("./components/ImageTools"));
const PdfTools = lazy(() => import("./components/PdfTools"));

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
  const [showPhotoBackgroundRemover, setShowPhotoBackgroundRemover] = useState(false);
  const [showImageTools, setShowImageTools] = useState(false);
  const [showPdfTools, setShowPdfTools] = useState(false);
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

  const openDocumentEditor = () => {
    setIsHomeScreen(false);
    setShowPassportPhotoMaker(false);
    setShowPhotoBackgroundRemover(false);
    setShowImageTools(false);
    setShowPdfTools(false);
  };

  const openPassportPhotoMaker = () => {
    setIsHomeScreen(false);
    setShowPassportPhotoMaker(true);
    setShowPhotoBackgroundRemover(false);
    setShowImageTools(false);
    setShowPdfTools(false);
  };

  const openBackgroundRemover = () => {
    setIsHomeScreen(false);
    setShowPhotoBackgroundRemover(true);
    setShowPassportPhotoMaker(false);
    setShowImageTools(false);
    setShowPdfTools(false);
  };

  const openImageTools = () => {
    setIsHomeScreen(false);
    setShowPassportPhotoMaker(false);
    setShowPhotoBackgroundRemover(false);
    setShowImageTools(true);
    setShowPdfTools(false);
  };

  const openPdfTools = () => {
    setIsHomeScreen(false);
    setShowPassportPhotoMaker(false);
    setShowPhotoBackgroundRemover(false);
    setShowImageTools(false);
    setShowPdfTools(true);
  };

  const returnToHome = () => {
    setIsHomeScreen(true);
    setShowPassportPhotoMaker(false);
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
      if (isHomeScreen || !(event.ctrlKey || event.metaKey)) return;

      switch (event.key.toLowerCase()) {
        case "s":
          event.preventDefault();
          void handleExport();
          break;
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [handleExport, isHomeScreen]);

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
                    !showPassportPhotoMaker &&
                    !showPhotoBackgroundRemover &&
                    !showImageTools) ||
                  showPassportPhotoMaker ||
                  showPhotoBackgroundRemover ||
                  showImageTools ||
                  showPdfTools
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
                  className="absolute right-0 top-full z-50 mt-2 w-[min(21rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-ui bg-surface p-2 text-left shadow-xl"
                >
                  <div className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                    Workspace
                  </div>
                  <button
                    type="button"
                    aria-current={
                      !isHomeScreen &&
                      !showPassportPhotoMaker &&
                      !showPhotoBackgroundRemover &&
                      !showImageTools &&
                      !showPdfTools
                        ? "page"
                        : undefined
                    }
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-action-subtle"
                    onClick={() => {
                      openDocumentEditor();
                      setShowToolsMenu(false);
                    }}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-action-emphasis" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-ink-primary">
                        Doc Stitch
                      </span>
                      <span className="mt-0.5 block text-[11px] text-ink-muted">
                        Arrange and print documents
                      </span>
                    </span>
                  </button>
                  <div className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                    Image &amp; photo
                  </div>
                  <button
                    type="button"
                    aria-current={showImageTools ? "page" : undefined}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-action-subtle"
                    onClick={() => {
                      openImageTools();
                      setShowToolsMenu(false);
                    }}
                  >
                    <Image className="h-4 w-4 shrink-0 text-action-emphasis" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-ink-strong">
                        Image Tools
                      </span>
                      <span className="mt-0.5 block text-[11px] text-ink-muted">
                        Resize, compress, and convert images
                      </span>
                    </span>
                  </button>
                  <div className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                    PDF
                  </div>
                  <button
                    type="button"
                    aria-current={showPdfTools ? "page" : undefined}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-action-subtle"
                    onClick={() => {
                      openPdfTools();
                      setShowToolsMenu(false);
                    }}
                  >
                    <FileStack className="h-4 w-4 shrink-0 text-action-emphasis" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-ink-primary">
                        PDF Tools
                      </span>
                      <span className="mt-0.5 block text-[11px] text-ink-muted">
                        Merge, convert, edit, and protect PDFs
                      </span>
                    </span>
                  </button>
                  <div className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                    Photo &amp; identity
                  </div>
                  <button
                    type="button"
                    aria-current={showPassportPhotoMaker ? "page" : undefined}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-action-subtle"
                    onClick={() => {
                      openPassportPhotoMaker();
                      setShowToolsMenu(false);
                    }}
                  >
                    <SquareUserRound className="h-4 w-4 shrink-0 text-action-emphasis" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-ink-primary">
                        Passport Photo Maker
                      </span>
                      <span className="mt-0.5 block text-[11px] text-ink-muted">
                        Arrange and print passport photos
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-current={showPhotoBackgroundRemover ? "page" : undefined}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-action-subtle"
                    onClick={() => {
                      openBackgroundRemover();
                      setShowToolsMenu(false);
                    }}
                  >
                    <ImageMinus className="h-4 w-4 shrink-0 text-action-emphasis" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-ink-strong">
                        Photo Background Remover
                      </span>
                      <span className="mt-0.5 block text-[11px] text-ink-muted">
                        Portrait cutouts · local AI
                      </span>
                    </span>
                  </button>

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
            onOpenPassportPhotoMaker={openPassportPhotoMaker}
            onOpenBackgroundRemover={openBackgroundRemover}
            onOpenImageTools={openImageTools}
            onOpenPdfTools={openPdfTools}
          />
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
        ) : showImageTools ? (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center bg-surface-muted text-sm font-medium text-ink-muted">
                Loading Image Tools…
              </div>
            }
          >
            <ImageTools onClose={returnToHome} />
          </Suspense>
        ) : showPdfTools ? (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center bg-surface-muted text-sm font-medium text-ink-muted">
                Loading PDF Tools…
              </div>
            }
          >
            <PdfTools onClose={returnToHome} />
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
