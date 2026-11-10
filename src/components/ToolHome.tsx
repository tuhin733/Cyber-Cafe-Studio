import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Crop,
  FileArchive,
  FileText,
  Files,
  FileImage,
  FileLock2,
  Eraser,
  Hash,
  Image,
  ImageMinus,
  ListOrdered,
  LockKeyholeOpen,
  PenLine,
  Pin,
  PinOff,
  Rocket,
  Search,
  Scissors,
  Stamp,
  Trash2,
  SquareUserRound,
  RotateCw,
  RefreshCw,
  Scaling,
  X,
} from "lucide-react";
import type { ImageToolMode } from "./ImageTools";
import type { PdfOperation } from "./PdfTools";
import { notifyUserError } from "../lib/userErrors";

interface Props {
  onOpenDocumentEditor: () => void;
  onOpenDocumentMaker: () => void;
  onOpenBiodataResumeMaker: () => void;
  onOpenPassportPhotoMaker: () => void;
  onOpenPhotoSignatureMaker: () => void;
  onOpenBackgroundRemover: () => void;
  onOpenImageTool: (mode: ImageToolMode) => void;
  onOpenPdfTool: (operation: PdfOperation) => void;
}

const tools = [
  {
    id: "documents",
    title: "Doc Stitch",
    description: "Arrange, resize, and print documents on A4 pages.",
    action: "Open editor",
    Icon: FileText,
  },
  {
    id: "document-maker",
    title: "Document Maker",
    description: "Write and format documents in English, Bangla, and Hindi.",
    action: "Start writing",
    Icon: FileText,
  },
  {
    id: "biodata-resume",
    title: "Biodata & Resume Maker",
    description: "Create personal biodata for any purpose or a job resume, then export a PDF.",
    action: "Create a resume",
    Icon: FileText,
  },
  {
    id: "passport",
    title: "Passport Photo Maker",
    description: "Create correctly sized passport and ID photo sheets.",
    action: "Make passport photos",
    Icon: SquareUserRound,
  },
  {
    id: "photo-signature",
    title: "Photo + Signature / Name & Date",
    description: "Place a signature image or print a name and date below a photo.",
    action: "Add details below photo",
    Icon: PenLine,
  },
  {
    id: "image-resize",
    title: "Photo & Signature Resizer",
    description: "Resize photos and signatures to the dimensions needed for online forms.",
    action: "Resize an image",
    Icon: Scaling,
  },
  {
    id: "image-crop",
    title: "Image Cropper",
    description: "Crop, straighten, and frame photos or scanned documents.",
    action: "Crop an image",
    Icon: Crop,
  },
  {
    id: "image-compress",
    title: "Image Compressor",
    description: "Reduce image file size for portals with upload limits.",
    action: "Compress an image",
    Icon: FileArchive,
  },
  {
    id: "image-convert",
    title: "Image Converter",
    description: "Convert images between supported file formats.",
    action: "Convert an image",
    Icon: RefreshCw,
  },
  {
    id: "pdf-merge",
    title: "Merge PDF",
    description: "Combine PDF files in your chosen order.",
    action: "Merge PDFs",
    Icon: Files,
  },
  {
    id: "pdf-split",
    title: "Split PDF",
    description: "Save page ranges from a PDF as separate files.",
    action: "Split a PDF",
    Icon: Scissors,
  },
  {
    id: "pdf-organize",
    title: "Organize PDF Pages",
    description: "Reorder pages in a PDF document.",
    action: "Organize pages",
    Icon: ListOrdered,
  },
  {
    id: "pdf-delete-pages",
    title: "Delete PDF Pages",
    description: "Remove selected pages from a PDF while keeping the rest.",
    action: "Delete pages",
    Icon: Trash2,
  },
  {
    id: "pdf-image-to-pdf",
    title: "Image to PDF",
    description: "Put scanned photos and images into a PDF.",
    action: "Create a PDF",
    Icon: Image,
  },
  {
    id: "pdf-to-image",
    title: "PDF to Image",
    description: "Export PDF pages as high-resolution images.",
    action: "Convert a PDF",
    Icon: FileImage,
  },
  {
    id: "pdf-compress",
    title: "Compress PDF",
    description: "Reduce PDF file size for online applications.",
    action: "Compress a PDF",
    Icon: FileArchive,
  },
  {
    id: "pdf-rotate",
    title: "Rotate PDF",
    description: "Correct the page orientation in a PDF.",
    action: "Rotate a PDF",
    Icon: RotateCw,
  },
  {
    id: "pdf-crop",
    title: "Crop PDF",
    description: "Trim extra borders from PDF pages.",
    action: "Crop a PDF",
    Icon: Crop,
  },
  {
    id: "pdf-page-numbers",
    title: "Add PDF Page Numbers",
    description: "Add page and total-page numbers to a PDF.",
    action: "Add page numbers",
    Icon: Hash,
  },
  {
    id: "pdf-add-watermark",
    title: "Add PDF Watermark",
    description: "Add custom text diagonally across every page of a PDF.",
    action: "Add watermark",
    Icon: Stamp,
  },
  {
    id: "pdf-remove-watermark",
    title: "Remove PDF Watermark",
    description: "Remove watermark annotations, find text watermarks, or cover a flattened area.",
    action: "Remove watermark",
    Icon: Eraser,
  },
  {
    id: "pdf-protect",
    title: "Protect PDF",
    description: "Set an opening password on a PDF.",
    action: "Protect a PDF",
    Icon: FileLock2,
  },
  {
    id: "pdf-unlock",
    title: "Unlock PDF",
    description: "Remove a PDF password when you have authorization.",
    action: "Unlock a PDF",
    Icon: LockKeyholeOpen,
  },
  {
    id: "background",
    title: "Background Remover",
    description: "Remove or replace the background in a portrait.",
    action: "Remove background",
    Icon: ImageMinus,
  },
] as const;

type Tool = (typeof tools)[number];
type ToolId = Tool["id"];

const PINNED_TOOLS_STORAGE_KEY = "cyber-cafe-studio-pinned-tools-v1";

export default function ToolHome({
  onOpenDocumentEditor,
  onOpenDocumentMaker,
  onOpenBiodataResumeMaker,
  onOpenPassportPhotoMaker,
  onOpenPhotoSignatureMaker,
  onOpenBackgroundRemover,
  onOpenImageTool,
  onOpenPdfTool,
}: Props) {
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [pinnedToolIds, setPinnedToolIds] = useState<ToolId[]>(() => {
    try {
      const stored = window.localStorage.getItem(PINNED_TOOLS_STORAGE_KEY);
      if (!stored) return [];
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return [...new Set(parsed.filter(
        (id): id is ToolId => tools.some((tool) => tool.id === id),
      ))];
    } catch (error) {
      console.error("Unable to load pinned tools.", error);
      return [];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PINNED_TOOLS_STORAGE_KEY,
        JSON.stringify(pinnedToolIds),
      );
    } catch (error) {
      console.error("Unable to save pinned tools.", error);
      notifyUserError("Pinned tools couldn't be saved on this device.");
    }
  }, [pinnedToolIds]);

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, []);

  const filteredTools = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return tools;
    return tools.filter((tool) =>
      `${tool.title} ${tool.description}`.toLowerCase().includes(normalizedQuery),
    );
  }, [query]);
  const pinnedToolIdSet = useMemo(() => new Set(pinnedToolIds), [pinnedToolIds]);
  const isSearching = query.trim().length > 0;
  const pinnedTools = filteredTools.filter((tool) => pinnedToolIdSet.has(tool.id));
  const otherTools = filteredTools.filter((tool) => !pinnedToolIdSet.has(tool.id));

  const togglePinnedTool = (toolId: ToolId) => {
    setPinnedToolIds((current) =>
      current.includes(toolId)
        ? current.filter((id) => id !== toolId)
        : [...current, toolId],
    );
  };

  const openTool = (toolId: (typeof tools)[number]["id"]) => {
    if (toolId === "documents") onOpenDocumentEditor();
    if (toolId === "document-maker") onOpenDocumentMaker();
    if (toolId === "biodata-resume") onOpenBiodataResumeMaker();
    if (toolId === "passport") onOpenPassportPhotoMaker();
    if (toolId === "photo-signature") onOpenPhotoSignatureMaker();
    if (toolId === "background") onOpenBackgroundRemover();
    if (toolId === "image-resize") onOpenImageTool("resize");
    if (toolId === "image-crop") onOpenImageTool("crop");
    if (toolId === "image-compress") onOpenImageTool("compress");
    if (toolId === "image-convert") onOpenImageTool("convert");
    if (toolId === "pdf-merge") onOpenPdfTool("merge");
    if (toolId === "pdf-split") onOpenPdfTool("split");
    if (toolId === "pdf-organize") onOpenPdfTool("organize");
    if (toolId === "pdf-delete-pages") onOpenPdfTool("delete-pages");
    if (toolId === "pdf-image-to-pdf") onOpenPdfTool("image-to-pdf");
    if (toolId === "pdf-to-image") onOpenPdfTool("pdf-to-image");
    if (toolId === "pdf-compress") onOpenPdfTool("compress");
    if (toolId === "pdf-rotate") onOpenPdfTool("rotate");
    if (toolId === "pdf-crop") onOpenPdfTool("crop");
    if (toolId === "pdf-page-numbers") onOpenPdfTool("page-numbers");
    if (toolId === "pdf-add-watermark") onOpenPdfTool("add-watermark");
    if (toolId === "pdf-remove-watermark") onOpenPdfTool("remove-watermark");
    if (toolId === "pdf-protect") onOpenPdfTool("protect");
    if (toolId === "pdf-unlock") onOpenPdfTool("unlock");
  };

  const renderToolCards = (toolList: readonly Tool[]) =>
    toolList.map(({ id, title, description, action, Icon }) => {
      const isPinned = pinnedToolIdSet.has(id);
      return (
        <article
          key={id}
          className="group flex min-h-56 flex-col rounded-2xl border border-ui bg-surface p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-action-border-strong hover:shadow-lg hover:shadow-ink-primary/5"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-action-subtle text-action">
              <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <button
              type="button"
              onClick={() => togglePinnedTool(id)}
              aria-label={isPinned ? `Unpin ${title}` : `Pin ${title}`}
              aria-pressed={isPinned}
              title={isPinned ? "Unpin tool" : "Pin tool"}
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action ${
                isPinned
                  ? "border-action-border bg-action-subtle text-action"
                  : "border-transparent text-ink-muted hover:border-ui hover:bg-surface-subtle hover:text-ink-primary"
              }`}
            >
              {isPinned ? (
                <PinOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Pin className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={() => openTool(id)}
            className="group/open mt-4 flex flex-1 flex-col items-start text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          >
            <span className="text-base font-semibold tracking-tight text-ink-primary">
              {title}
            </span>
            <span className="mt-2 text-sm leading-6 text-ink-secondary">
              {description}
            </span>
            <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-action">
              {action}
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover/open:translate-x-1"
                aria-hidden="true"
              />
            </span>
          </button>
        </article>
      );
    });

  return (
    <main className="app-home-background scrollbar-hidden relative min-h-0 flex-1 overflow-y-auto bg-fixed">
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col justify-center px-5 py-8 sm:px-8 sm:py-10">
        <header className="mx-auto mb-2 flex items-center justify-center gap-3 sm:mb-3">
          <img
            src="./cyber_cafe_studio_teal.svg"
            alt=""
            className="h-14 w-14 shrink-0"
            aria-hidden="true"
          />
          <div className="text-left">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-xl font-bold tracking-tight text-ink-primary sm:text-2xl">
                Cyber Cafe Studio
              </span>
            </div>
            <span className="mt-0.5 block text-sm text-ink-secondary sm:text-base">
              Made for cyber cafe owners
            </span>
          </div>
        </header>

        <div className="mx-auto w-full max-w-3xl text-center">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-ink-primary sm:text-5xl">
            Everything your cyber cafe needs.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-ink-secondary sm:text-base sm:leading-7">
            Prepare documents, create passport and ID photos, and edit images and PDFs—all in one easy-to-use workspace.
          </p>

        </div>

        <div
          role="search"
          className="group sticky top-4 z-10 mx-auto mt-7 flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-ui bg-surface/95 px-4 py-3 text-left shadow-lg shadow-ink-primary/5 backdrop-blur transition duration-200 hover:border-ui-strong focus-within:border-action-emphasis focus-within:shadow-xl focus-within:shadow-action/10 focus-within:ring-4 focus-within:ring-action-soft/70 sm:gap-4 sm:px-5 sm:py-3.5"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-subtle text-ink-muted transition-colors group-focus-within:bg-action-subtle group-focus-within:text-action">
            <Search className="h-4 w-4" aria-hidden="true" />
          </span>
          <input
            ref={searchInputRef}
            aria-label="Search tools"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tools by name or task..."
            className="tool-search-input min-w-0 flex-1 bg-transparent py-2 text-sm text-ink-primary outline-none placeholder:text-ink-muted sm:text-base"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                searchInputRef.current?.focus();
              }}
              aria-label="Clear search"
              title="Clear search"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-subtle hover:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <kbd className="hidden shrink-0 items-center rounded-md border border-ui bg-surface-muted px-2 py-1 font-sans text-[11px] font-medium text-ink-muted shadow-sm sm:inline-flex">
              Ctrl K
            </kbd>
          )}
        </div>

        <section
          className="mx-auto mt-10 w-full max-w-6xl sm:mt-12"
          aria-label="Available tools"
        >
          {!isSearching && pinnedTools.length > 0 && (
            <div className="mb-8">
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-ink-primary">
                  Pinned tools
                </h2>
                <span className="rounded-full bg-action-subtle px-2.5 py-1 text-xs font-medium text-action">
                  {pinnedTools.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {renderToolCards(pinnedTools)}
              </div>
            </div>
          )}
          {(isSearching || otherTools.length > 0) && (
            <>
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-ink-primary">
                  {isSearching ? "Search results" : "Explore your tools"}
                </h2>
                <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-medium text-ink-secondary">
                  {isSearching ? filteredTools.length : otherTools.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {renderToolCards(isSearching ? filteredTools : otherTools)}
                {filteredTools.length === 0 && (
                  <p className="col-span-full rounded-2xl border border-dashed border-ui-strong bg-surface px-6 py-10 text-center text-sm text-ink-muted">
                    No tools found. Try a different search.
                  </p>
                )}
              </div>
            </>
          )}
        </section>

        <footer className="mx-auto mt-8 flex items-center justify-center gap-2 text-sm text-ink-muted">
          <span className="inline-flex items-center gap-2">
            <Rocket className="h-4 w-4 text-action-emphasis" aria-hidden="true" />
            More tools coming soon
          </span>
        </footer>
      </div>
    </main>
  );
}
