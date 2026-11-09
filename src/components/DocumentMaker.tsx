import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import { generateHTML, generateText } from "@tiptap/core";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  Check,
  Copy,
  Download,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  MoreVertical,
  Pipette,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Table2,
  Redo2,
  ChevronDown,
  SpellCheck,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  Upload,
  WandSparkles,
} from "lucide-react";
import BackToToolsButton from "./BackToToolsButton";
import DocumentMakerPageEditor from "./DocumentMakerPage";
import Dropdown, { type DropdownOption } from "./Dropdown";
import AutoSaveStatusIndicator from "./AutoSaveStatusIndicator";
import DialogFrame from "./DialogFrame";
import InputField from "./InputField";
import {
  DocumentExportDialog,
  DocumentFindReplaceDialog,
  DocumentLayoutDialog,
  DocumentLibraryDialog,
  DocumentTemplateDialog,
} from "./DocumentMakerDialogs";
import {
  DEFAULT_DOCUMENT_MAKER_LAYOUT,
  createDocumentMakerPage,
  deleteDocumentMakerPage,
  duplicateDocumentMakerPage,
  getDocumentMakerContentInsets,
  getDocumentMakerPageDimensions,
  insertDocumentMakerPage,
  moveDocumentMakerPage,
  removeLegacyDocumentShapes,
  type DocumentMakerLanguage,
  type DocumentMakerLayout,
  type DocumentMakerPage,
} from "../lib/documentMaker";
import { DOCUMENT_MAKER_EXTENSIONS } from "../lib/documentMakerExtensions";
import {
  getDocumentMakerFontFamily,
  getBundledDocumentFonts,
  getUploadedDocumentFonts,
  registerBundledDocumentFont,
  registerDocumentMakerFont,
  saveUploadedDocumentFont,
  type UploadedDocumentFont,
} from "../lib/documentMakerFonts";
import { generateDocumentMakerPdf } from "../lib/documentMakerPdf";
import { createDocumentMakerPreviewHtml } from "../lib/documentMakerPdf";
import { exportDocumentMakerDocx, importDocumentMakerDocx } from "../lib/documentMakerDocx";
import {
  deleteDocumentMakerDocument,
  listSavedDocumentMakerDocuments,
  saveDocumentMakerDocument,
  type SavedDocumentMakerDocument,
} from "../lib/documentMakerStorage";
import { DOCUMENT_MAKER_TEMPLATES, type DocumentMakerTemplate } from "../lib/documentMakerTemplates";
import { useToolAutoSave } from "../hooks/useToolAutoSave";
import { downloadBlob, savePDF } from "../lib/pdf";
interface Props {
  onClose: () => void;
}

interface DocumentMakerSession {
  version: 1;
  id: string;
  title: string;
  pages: DocumentMakerPage[];
  layout: DocumentMakerLayout;
  language: DocumentMakerLanguage;
  spellCheck: boolean;
  autoCorrect: boolean;
}

const MAX_DOCX_IMPORT_BYTES = 25 * 1024 * 1024;
const DEFAULT_DOCUMENT_TITLE = "Untitled document";

function sanitizeDocumentFileName(value: string) {
  const safeName = Array.from(value.trim())
    .map((character) =>
      /[<>:"/\\|?*]/.test(character) || character.charCodeAt(0) < 32
        ? "-"
        : character,
    )
    .join("")
    .replace(/\.(?:pdf|docx)$/i, "")
    .trim();
  return safeName || "document";
}

const LANGUAGES: { id: DocumentMakerLanguage; label: string; nativeLabel: string }[] = [
  { id: "english", label: "English", nativeLabel: "English" },
  { id: "bengali", label: "বাংলা", nativeLabel: "Bangla" },
  { id: "hindi", label: "हिन्दी", nativeLabel: "Hindi" },
];

const FONT_SIZES = [
  "10px",
  "11px",
  "12px",
  "14px",
  "16px",
  "18px",
  "20px",
  "24px",
  "28px",
  "32px",
  "36px",
  "48px",
];

const LANGUAGE_FONT_FAMILIES: Record<DocumentMakerLanguage, string[]> = {
  bengali: [
    "Noto Sans Bengali",
    "Noto Serif Bengali",
    "SolaimanLipi",
    "Kalpurush",
    "Siyam Rupali",
    "Vrinda",
    "Mukti",
  ],
  english: [
    "Arial",
    "Calibri",
    "Cambria",
    "Courier New",
    "Georgia",
    "Segoe UI",
    "Tahoma",
    "Times New Roman",
    "Trebuchet MS",
    "Verdana",
  ],
  hindi: [
    "Noto Sans Devanagari",
    "Noto Serif Devanagari",
    "Mangal",
    "Aparajita",
    "Kokila",
    "Nirmala UI",
  ],
};

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  preserveSelection = false,
  onClick,
  children,
  className = "",
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  preserveSelection?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={preserveSelection ? (event) => event.preventDefault() : undefined}
      onClick={onClick}
      className={`document-maker-toolbar-button ${className} inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-action-subtle text-action"
          : "text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
      }`}
    >
      {children}
    </button>
  );
}

const TEXT_COLOR_PALETTE = [
  ["#000000", "#404040", "#666666", "#808080", "#999999", "#B3B3B3", "#D9D9D9", "#FFFFFF"],
  ["#C00000", "#F00000", "#FF9900", "#FFFF00", "#00B050", "#00B0F0", "#4472C4", "#0000FF", "#7030A0"],
  ...[88, 75, 60, 45, 30].map((lightness) =>
    [0, 330, 30, 50, 100, 180, 210, 230, 270].map(
      (hue) => `hsl(${hue} 55% ${lightness}%)`,
    ),
  ),
];

interface EyeDropperConstructor {
  new (): {
    open: () => Promise<{ sRGBHex: string }>;
  };
}

function TextColorPicker({
  color,
  disabled,
  className = "",
  onChange,
  onReset,
  onError,
}: {
  color: string;
  disabled?: boolean;
  className?: string;
  onChange: (color: string) => void;
  onReset: () => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const pickerInputRef = useRef<HTMLInputElement>(null);

  const selectColor = (nextColor: string, addToRecent = false) => {
    onChange(nextColor);
    if (addToRecent) {
      setRecentColors((current) => [
        nextColor,
        ...current.filter((recent) => recent.toLowerCase() !== nextColor.toLowerCase()),
      ].slice(0, 9));
    }
    setOpen(false);
  };

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const popover = popoverRef.current?.getBoundingClientRect();
      if (!anchor || !popover) return;
      const left = Math.max(8, Math.min(anchor.left, window.innerWidth - popover.width - 8));
      const below = anchor.bottom + 4;
      const top =
        below + popover.height <= window.innerHeight - 8
          ? below
          : Math.max(8, anchor.top - popover.height - 4);
      setPosition({ left, top });
    };

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !anchorRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    updatePosition();
    document.addEventListener("pointerdown", handleOutsidePointerDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const pickFromScreen = async () => {
    const EyeDropper = (window as Window & {
      EyeDropper?: EyeDropperConstructor;
    }).EyeDropper;
    if (!EyeDropper || !window.isSecureContext) {
      pickerInputRef.current?.click();
      return;
    }
    try {
      const result = await new EyeDropper().open();
      selectColor(result.sRGBHex, true);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Could not pick a color from the screen:", error);
      onError("Could not pick a color from the screen. Choose a custom color instead.");
    }
  };

  const inputColor = /^#[\da-f]{6}$/i.test(color) ? color : "#000000";

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label="Text color"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((current) => !current)}
        className={`document-maker-toolbar-button relative inline-flex h-9 w-9 flex-col items-center justify-center rounded-lg text-ink-secondary hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      >
        <span className="text-sm font-bold leading-none" aria-hidden="true">A</span>
        <span
          className="mt-0.5 h-1 w-4 rounded-sm"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Text color palette"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                anchorRef.current?.focus();
              }
            }}
            className="fixed z-50 max-h-[min(70vh,32rem)] w-[min(20rem,calc(100vw-1rem))] overflow-auto rounded-xl border border-ui bg-surface p-3 shadow-xl"
            style={{
              left: position?.left ?? 0,
              top: position?.top ?? 0,
              visibility: position ? "visible" : "hidden",
            }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
                Pre-designated colors
              </h3>
              <button
                type="button"
                aria-label="Reset text color"
                title="Reset to automatic color"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onReset();
                  setOpen(false);
                }}
                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-ink-secondary hover:bg-surface-subtle"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Reset
              </button>
            </div>
            <div className="space-y-1.5">
              {TEXT_COLOR_PALETTE.map((row, rowIndex) => (
                <div key={rowIndex} className="flex items-center justify-between gap-1">
                  {row.map((swatch) => {
                    const selected = swatch.toLowerCase() === color.toLowerCase();
                    return (
                      <button
                        key={swatch}
                        type="button"
                        aria-label={`Set text color to ${swatch}`}
                        aria-pressed={selected}
                        title={swatch}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectColor(swatch)}
                        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ui/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-action ${
                          selected ? "ring-2 ring-action ring-offset-1 ring-offset-surface" : ""
                        }`}
                        style={{ backgroundColor: swatch }}
                      >
                        {selected && (
                          <Check
                            className={`h-4 w-4 drop-shadow ${
                              ["#000000", "#404040", "#666666", "#0000FF", "#7030A0"].includes(swatch.toUpperCase())
                                ? "text-white"
                                : "text-ink-primary"
                            }`}
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-ui pt-2">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                Custom
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {recentColors.map((recentColor) => (
                  <button
                    key={recentColor}
                    type="button"
                    aria-label={`Use recent text color ${recentColor}`}
                    title={recentColor}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectColor(recentColor)}
                    className="h-6 w-6 rounded-full border border-ui focus-visible:outline focus-visible:outline-2 focus-visible:outline-action"
                    style={{ backgroundColor: recentColor }}
                  />
                ))}
                <button
                  type="button"
                  aria-label="Choose a custom color"
                  title="Choose a custom color"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pickerInputRef.current?.click()}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-ui text-ink-secondary hover:bg-surface-subtle"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Pick a color from the screen"
                  title="Pick a color from the screen"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void pickFromScreen()}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-ui text-ink-secondary hover:bg-surface-subtle"
                >
                  <Pipette className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <input
                ref={pickerInputRef}
                type="color"
                aria-label="Choose a custom text color"
                value={inputColor}
                onChange={(event) => selectColor(event.target.value, true)}
                className="pointer-events-none absolute h-px w-px opacity-0"
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

interface ToolbarMenuItem {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  checkbox?: boolean;
  compactOnly?: boolean;
  onSelect: () => void;
}

function MoreToolbarMenu({
  open,
  onToggle,
  onClose,
  items,
  compactItems,
  tinyTools,
  fontPicker,
  textColorPicker,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  items: ToolbarMenuItem[];
  compactItems: ToolbarMenuItem[];
  tinyTools: React.ReactNode;
  fontPicker: React.ReactNode;
  textColorPicker: React.ReactNode;
}) {
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top?: number;
    bottom?: number;
  } | null>(null);

  const toggleMenu = () => {
    if (open) {
      onClose();
      return;
    }
    const bounds = moreButtonRef.current?.getBoundingClientRect();
    if (bounds) {
      const maxHeight = Math.min(window.innerHeight * 0.7, 512);
      const opensUp = window.innerHeight - bounds.bottom < maxHeight + 8;
      setMenuPosition({
        left: Math.max(8, Math.min(bounds.left, window.innerWidth - 264)),
        ...(opensUp
          ? { bottom: window.innerHeight - bounds.top + 4 }
          : { top: bounds.bottom + 4 }),
      });
    }
    onToggle();
  };

  return (
    <div
      className="document-maker-toolbar-more relative hidden"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onClose();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onClose();
          moreButtonRef.current?.focus();
        }
      }}
    >
      <button
        ref={moreButtonRef}
        type="button"
        aria-label="More formatting and editing tools"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggleMenu}
        className={`document-maker-toolbar-button inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-action ${
          open ? "bg-action-subtle text-action" : "text-ink-secondary hover:bg-surface-subtle"
        }`}
      >
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
        More
        <ChevronDown className="h-3 w-3" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="More document tools"
          className="fixed z-50 flex max-h-[min(70vh,32rem)] w-64 flex-col overflow-auto rounded-xl border border-ui bg-surface p-1.5 shadow-xl"
          style={menuPosition ?? undefined}
        >
          <div className="document-maker-more-compact p-1.5">{fontPicker}</div>
          <div className="document-maker-more-tiny flex-col gap-2 p-1.5">{tinyTools}</div>
          <div className="my-1 border-t border-ui" />
          {[...items, ...compactItems].map(({ label, icon, active, disabled, checkbox, compactOnly, onSelect }) => (
            <button
              key={label}
              type="button"
              role={checkbox ? "menuitemcheckbox" : "menuitem"}
              aria-checked={checkbox ? Boolean(active) : undefined}
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect();
                onClose();
              }}
              className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-ink-primary hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40 ${
                compactOnly ? "document-maker-more-compact" : ""
              }`}
            >
              <span className="flex h-4 w-4 items-center justify-center text-ink-secondary">{icon}</span>
              <span className="flex-1">{label}</span>
              {active !== undefined && (
                <span className="text-xs text-action">{active ? "On" : "Off"}</span>
              )}
            </button>
          ))}
          <div className="document-maker-more-compact flex min-h-9 items-center justify-between gap-2 rounded-lg px-2.5 py-1 text-sm text-ink-primary">
            <span className="flex-1">Text color</span>
            {textColorPicker}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarDropdown({
  label,
  icon,
  items,
  open,
  active = false,
  disabled = false,
  onToggle,
  onClose,
}: {
  label: string;
  icon: React.ReactNode;
  items: ToolbarMenuItem[];
  open: boolean;
  active?: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onClose();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-pressed={active}
        disabled={disabled}
        onClick={onToggle}
        className={`inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-action ${
          open || active ? "bg-action-subtle text-action" : "text-ink-secondary hover:bg-surface-subtle"
        }`}
      >
        {icon}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute left-0 top-full z-40 mt-1 flex min-w-max items-center gap-1 rounded-xl border border-ui bg-surface p-1.5 shadow-lg"
        >
          {items.map(({ label: itemLabel, icon: itemIcon, active, disabled: itemDisabled, onSelect }) => (
            <button
              key={itemLabel}
              type="button"
              role="menuitem"
              aria-label={itemLabel}
              aria-pressed={active}
              disabled={itemDisabled || disabled}
              title={itemLabel}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect();
                onClose();
              }}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-action ${
                itemDisabled || disabled
                  ? "cursor-not-allowed text-ink-faint"
                  : active
                  ? "bg-action-soft text-action"
                  : "text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
              }`}
            >
              {itemIcon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getPagePreview(page: DocumentMakerPage) {
  const text = generateText(removeLegacyDocumentShapes(page.content), DOCUMENT_MAKER_EXTENSIONS, {
    blockSeparator: " ",
  })
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

function hasDocumentContent(page: DocumentMakerPage) {
  const containsContent = (node: DocumentMakerPage["content"]): boolean => {
    if (node.text?.trim()) return true;
    if (node.type === "image") return true;
    return node.content?.some((child) =>
      containsContent(child as DocumentMakerPage["content"]),
    ) ?? false;
  };
  return containsContent(page.content);
}

export default function DocumentMaker({ onClose }: Props) {
  const [language, setLanguage] = useState<DocumentMakerLanguage>("english");
  const [spellCheck, setSpellCheck] = useState(true);
  const [autoCorrect, setAutoCorrect] = useState(true);
  const [pages, setPages] = useState<DocumentMakerPage[]>(() => [
    createDocumentMakerPage(),
  ]);
  const [activePageId, setActivePageId] = useState(pages[0].id);
  const [currentDocumentId, setCurrentDocumentId] = useState<string>(() => crypto.randomUUID());
  const [documentTitle, setDocumentTitle] = useState(DEFAULT_DOCUMENT_TITLE);
  const [layout, setLayout] = useState<DocumentMakerLayout>(() =>
    structuredClone(DEFAULT_DOCUMENT_MAKER_LAYOUT),
  );
  const [savedDocuments, setSavedDocuments] = useState<SavedDocumentMakerDocument[]>([]);
  const [libraryReady, setLibraryReady] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linkIsEditing, setLinkIsEditing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [docxImporting, setDocxImporting] = useState(false);
  const [exportFileName, setExportFileName] = useState("Untitled document");
  const [autoFocusPageId, setAutoFocusPageId] = useState<string | null>(null);
  const [pageMenu, setPageMenu] = useState<{
    pageId: string;
    left: number;
    top: number;
  } | null>(null);
  const [confirmDeletePageId, setConfirmDeletePageId] = useState<string | null>(null);
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const [, setEditorSelectionVersion] = useState(0);
  const linkSelectionRef = useRef<{
    editor: Editor;
    from: number;
    to: number;
  } | null>(null);
  const tablePickerAnchorRef = useRef<HTMLDivElement>(null);
  const tablePickerRef = useRef<HTMLDivElement>(null);
  const [uploadedFonts, setUploadedFonts] = useState<UploadedDocumentFont[]>([]);
  const [bundledFonts, setBundledFonts] = useState<
    Partial<Record<DocumentMakerLanguage, string[]>>
  >({});
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [tableColumns, setTableColumns] = useState(3);
  const [tableRows, setTableRows] = useState(3);
  const [textColor, setTextColor] = useState("#000000");
  const [tablePickerPosition, setTablePickerPosition] = useState<{ left: number; top: number } | null>(null);
  const [openToolbarMenu, setOpenToolbarMenu] = useState<
    "alignment" | "list" | "proofing" | "more" | null
  >(null);
  const editorByPage = useRef(new Map<string, Editor>());
  const activePageIdRef = useRef(activePageId);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const docxInputRef = useRef<HTMLInputElement>(null);
  const librarySaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const librarySaveRequestRef = useRef(0);

  const restoreDocumentMakerSession = useCallback(async (saved: DocumentMakerSession) => {
    if (
      saved?.version !== 1 ||
      typeof saved.id !== "string" ||
      typeof saved.title !== "string" ||
      !Array.isArray(saved.pages) ||
      saved.pages.length === 0 ||
      !saved.pages.every((page) => page && typeof page.id === "string" && page.content?.type === "doc") ||
      !["english", "bengali", "hindi"].includes(saved.language) ||
      typeof saved.spellCheck !== "boolean" ||
      typeof saved.autoCorrect !== "boolean" ||
      !saved.layout ||
      !["A4", "Letter", "Legal"].includes(saved.layout.paperSize) ||
      !["portrait", "landscape"].includes(saved.layout.orientation) ||
      !saved.layout.margins ||
      !["top", "right", "bottom", "left"].every((side) =>
        Number.isFinite(saved.layout.margins[side as keyof DocumentMakerLayout["margins"]]) &&
        saved.layout.margins[side as keyof DocumentMakerLayout["margins"]] >= 0 &&
        saved.layout.margins[side as keyof DocumentMakerLayout["margins"]] <= 60,
      ) ||
      typeof saved.layout.header !== "string" ||
      typeof saved.layout.footer !== "string" ||
      typeof saved.layout.pageNumbers !== "boolean"
    ) {
      throw new Error("The saved Document Maker session is invalid.");
    }
    setCurrentDocumentId(saved.id);
    setDocumentTitle(saved.title);
    const restoredPages = saved.pages.map((page) => ({
      ...page,
      content: removeLegacyDocumentShapes(page.content),
    }));
    setPages(restoredPages);
    setLayout(saved.layout);
    setLanguage(saved.language);
    setSpellCheck(saved.spellCheck);
    setAutoCorrect(saved.autoCorrect);
    activePageIdRef.current = restoredPages[0].id;
    setActivePageId(restoredPages[0].id);
    setAutoFocusPageId(null);
    setActiveEditor(null);
  }, []);

  const documentMakerSession = useMemo<DocumentMakerSession>(() => ({
    version: 1,
    id: currentDocumentId,
    title: documentTitle,
    pages,
    layout,
    language,
    spellCheck,
    autoCorrect,
  }), [autoCorrect, currentDocumentId, documentTitle, language, layout, pages, spellCheck]);

  const autoSave = useToolAutoSave(
    "document-maker",
    documentMakerSession,
    restoreDocumentMakerSession,
    libraryReady,
  );

  useEffect(() => {
    let active = true;
    void listSavedDocumentMakerDocuments()
      .then((documents) => {
        if (active) setSavedDocuments(documents);
      })
      .catch((error: unknown) => {
        console.error("Could not load the saved document library:", error);
        if (active) setMessage("Saved documents are unavailable on this device.");
      })
      .finally(() => {
        if (active) setLibraryReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (
      !autoSave.isLoaded ||
      !libraryReady ||
      (!pages.some(hasDocumentContent) && documentTitle === DEFAULT_DOCUMENT_TITLE)
    ) {
      return;
    }

    const requestId = ++librarySaveRequestRef.current;
    const timeout = window.setTimeout(() => {
      const save = librarySaveQueueRef.current.then(async () => {
        const saved = await saveDocumentMakerDocument(documentMakerSession);
        if (requestId === librarySaveRequestRef.current) {
          setSavedDocuments((current) => [
            saved,
            ...current.filter((document) => document.id !== saved.id),
          ].sort((left, right) => right.updatedAt - left.updatedAt));
        }
      });
      librarySaveQueueRef.current = save.catch((error: unknown) => {
        console.error("Could not autosave the document library copy:", error);
        if (requestId === librarySaveRequestRef.current) {
          setMessage("The recovery copy is saved, but this document could not be added to your library.");
        }
      });
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [autoSave.isLoaded, documentMakerSession, documentTitle, libraryReady, pages]);

  useEffect(() => {
    let cancelled = false;
    const loadBundledFonts = async () => {
      const loadedFonts: Partial<Record<DocumentMakerLanguage, string[]>> = {};
      for (const font of getBundledDocumentFonts()) {
        try {
          await registerBundledDocumentFont(font);
          loadedFonts[font.language] = [
            ...(loadedFonts[font.language] ?? []),
            font.family,
          ];
        } catch (error) {
          console.error(`Could not load bundled font "${font.family}":`, error);
          if (!cancelled) setMessage(`Could not load bundled font "${font.family}".`);
        }
      }
      if (!cancelled) setBundledFonts(loadedFonts);
    };

    void loadBundledFonts();
    void getUploadedDocumentFonts()
      .then(async (fonts) => {
        const loadedFonts: UploadedDocumentFont[] = [];
        for (const font of fonts) {
          try {
            await registerDocumentMakerFont(font);
            loadedFonts.push(font);
          } catch (error) {
            console.error(`Could not load uploaded font "${font.family}":`, error);
            if (!cancelled) setMessage(`Could not load saved font "${font.family}".`);
          }
        }
        if (!cancelled) setUploadedFonts(loadedFonts);
      })
      .catch((error: unknown) => {
        console.error("Could not load saved document fonts:", error);
        if (!cancelled) setMessage("Could not load saved fonts from this device.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activatePage = useCallback((pageId: string) => {
    activePageIdRef.current = pageId;
    setActivePageId(pageId);
    setActiveEditor(editorByPage.current.get(pageId) ?? null);
    setPageMenu(null);
    setConfirmDeletePageId(null);
    setMessage("");
  }, []);

  const togglePageMenu = (
    pageId: string,
    bounds: { left: number; top: number; bottom: number; right: number },
  ) => {
    if (pageMenu?.pageId === pageId) {
      setPageMenu(null);
      return;
    }

    const menuWidth = 192;
    const menuHeight = confirmDeletePageId === pageId ? 100 : 250;
    setPageMenu({
      pageId,
      left: Math.max(8, Math.min(bounds.right - menuWidth, window.innerWidth - menuWidth - 8)),
      top: Math.max(8, Math.min(bounds.bottom + 4, window.innerHeight - menuHeight - 8)),
    });
    setConfirmDeletePageId(null);
  };

  const handleEditorReady = useCallback((pageId: string, editor: Editor | null) => {
    if (editor) editorByPage.current.set(pageId, editor);
    else editorByPage.current.delete(pageId);
    if (activePageIdRef.current === pageId) setActiveEditor(editor);
  }, []);

  const handleEditorSelectionUpdate = useCallback((pageId: string) => {
    if (activePageIdRef.current === pageId) {
      setEditorSelectionVersion((current) => current + 1);
    }
  }, []);

  useEffect(() => {
    document
      .getElementById(`document-maker-page-${activePageId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activePageId, pages.length]);

  const handlePageContentChange = useCallback(
    (pageId: string, content: DocumentMakerPage["content"]) => {
      setPages((current) =>
        current.map((page) => (page.id === pageId ? { ...page, content } : page)),
      );
    },
    [],
  );

  const handleAutoPage = useCallback(
    (
      pageId: string,
      content: DocumentMakerPage["content"],
      activateNextPage = true,
    ) => {
      const newPage = createDocumentMakerPage(content);
      setPages((current) => {
        const index = current.findIndex((page) => page.id === pageId);
        if (index < 0) return current;
        return insertDocumentMakerPage(current, index + 1, newPage);
      });
      if (!activateNextPage) return;
      activePageIdRef.current = newPage.id;
      setActivePageId(newPage.id);
      setActiveEditor(null);
      setAutoFocusPageId(newPage.id);
      setPageMenu(null);
    },
    [],
  );

  const handleAutoPageFocused = useCallback((pageId: string) => {
    setAutoFocusPageId((current) => current === pageId ? null : current);
  }, []);

  const persistDocument = useCallback(async (
    document: Pick<SavedDocumentMakerDocument, "id" | "title" | "pages" | "layout">,
  ) => {
    const saved = await saveDocumentMakerDocument(document);
    setSavedDocuments((current) => [
      saved,
      ...current.filter((item) => item.id !== saved.id),
    ].sort((left, right) => right.updatedAt - left.updatedAt));
  }, []);

  const preserveCurrentDocument = useCallback(async () => {
    if (!autoSave.isLoaded) return false;
    if (
      !pages.some(hasDocumentContent) &&
      documentTitle === DEFAULT_DOCUMENT_TITLE &&
      !savedDocuments.some((document) => document.id === currentDocumentId)
    ) {
      return true;
    }
    try {
      await persistDocument({
        id: currentDocumentId,
        title: documentTitle.trim() || DEFAULT_DOCUMENT_TITLE,
        pages,
        layout,
      });
      return true;
    } catch (error) {
      console.error("Could not preserve the current document before switching:", error);
      setMessage("Could not save your current document. Please retry before switching.");
      return false;
    }
  }, [
    autoSave.isLoaded,
    currentDocumentId,
    documentTitle,
    layout,
    pages,
    persistDocument,
    savedDocuments,
  ]);

  const saveCurrentDocument = useCallback(async () => {
    const saved = await preserveCurrentDocument();
    if (saved) {
      setMessage("Document saved to your library.");
    }
  }, [preserveCurrentDocument]);

  const resetToNewDocument = () => {
    const page = createDocumentMakerPage();
    const id = crypto.randomUUID();
    setCurrentDocumentId(id);
    setDocumentTitle(DEFAULT_DOCUMENT_TITLE);
    setPages([page]);
    setLayout(structuredClone(DEFAULT_DOCUMENT_MAKER_LAYOUT));
    activePageIdRef.current = page.id;
    setActivePageId(page.id);
    setActiveEditor(null);
    setAutoFocusPageId(null);
    setLibraryOpen(false);
    setMessage("");
  };

  const startNewDocument = async () => {
    if (await preserveCurrentDocument()) resetToNewDocument();
  };

  const openSavedDocument = async (saved: SavedDocumentMakerDocument) => {
    if (saved.id !== currentDocumentId && !(await preserveCurrentDocument())) return;
    const restoredPages = saved.pages.map((page) => ({
      ...page,
      content: removeLegacyDocumentShapes(page.content),
    }));
    setCurrentDocumentId(saved.id);
    setDocumentTitle(saved.title);
    setPages(restoredPages);
    setLayout(saved.layout);
    activePageIdRef.current = restoredPages[0].id;
    setActivePageId(restoredPages[0].id);
    setActiveEditor(null);
    setAutoFocusPageId(null);
    setLibraryOpen(false);
    setMessage(`Opened "${saved.title}".`);
  };

  const renameSavedDocument = async (
    saved: SavedDocumentMakerDocument,
    title: string,
  ) => {
    try {
      await persistDocument({ ...saved, title });
      if (saved.id === currentDocumentId) setDocumentTitle(title);
      setMessage("Document renamed.");
    } catch (error) {
      console.error("Could not rename the saved document:", error);
      setMessage("Could not rename this document.");
    }
  };

  const deleteSavedDocument = async (saved: SavedDocumentMakerDocument) => {
    if (!window.confirm(`Delete "${saved.title}" from this device?`)) return;
    try {
      await deleteDocumentMakerDocument(saved.id);
      setSavedDocuments((current) => current.filter((item) => item.id !== saved.id));
      if (saved.id === currentDocumentId) resetToNewDocument();
      setMessage("Document deleted.");
    } catch (error) {
      console.error("Could not delete the saved document:", error);
      setMessage("Could not delete this document.");
    }
  };

  const applyTemplate = async (template: DocumentMakerTemplate) => {
    if (!(await preserveCurrentDocument())) return;
    const nextPages = template.pages.map((page) => createDocumentMakerPage(page.content));
    const id = crypto.randomUUID();
    setCurrentDocumentId(id);
    setDocumentTitle(template.title);
    setPages(nextPages);
    setLayout(structuredClone(template.layout));
    activePageIdRef.current = nextPages[0].id;
    setActivePageId(nextPages[0].id);
    setActiveEditor(null);
    setTemplatesOpen(false);
    setMessage(`Started from the ${template.title} template.`);
  };

  const importDocxFile = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_DOCX_IMPORT_BYTES) {
      setMessage("Choose a DOCX file smaller than 25 MB.");
      return;
    }
    setDocxImporting(true);
    setMessage("");
    try {
      const importedPages = await importDocumentMakerDocx(file);
      if (!(await preserveCurrentDocument())) return;
      const id = crypto.randomUUID();
      setCurrentDocumentId(id);
      setDocumentTitle(file.name.replace(/\.docx$/i, "") || DEFAULT_DOCUMENT_TITLE);
      setPages(importedPages);
      setLayout(structuredClone(DEFAULT_DOCUMENT_MAKER_LAYOUT));
      activePageIdRef.current = importedPages[0].id;
      setActivePageId(importedPages[0].id);
      setActiveEditor(null);
      setMessage(`Imported "${file.name}". Review the layout before exporting.`);
    } catch (error) {
      console.error("Could not import the selected DOCX document:", error);
      setMessage(error instanceof Error ? error.message : "Could not import that DOCX file.");
    } finally {
      setDocxImporting(false);
    }
  };

  const addPageAfter = (index: number, duplicate = false) => {
    const source = pages[index];
    if (!source) return;
    const page = duplicate
      ? duplicateDocumentMakerPage(source)
      : createDocumentMakerPage();
    setPages((current) => insertDocumentMakerPage(current, index + 1, page));
    activatePage(page.id);
  };

  const movePage = (index: number, direction: -1 | 1) => {
    setPages((current) => moveDocumentMakerPage(current, index, direction));
    setPageMenu(null);
  };

  const deletePage = (index: number) => {
    const nextPages = deleteDocumentMakerPage(pages, index);
    if (nextPages === pages) return;
    const nextActivePage = nextPages[Math.min(index, nextPages.length - 1)];
    setPages(nextPages);
    activatePage(nextActivePage.id);
  };

  const copyDocument = async (withStyles: boolean) => {
    const text = pages
      .map((page) =>
        generateText(page.content, DOCUMENT_MAKER_EXTENSIONS, { blockSeparator: "\n" }).trim() ||
          getPagePreview(page),
      )
      .join("\n\n");
    if (!text.trim()) {
      setMessage("Write something before copying.");
      return;
    }

    try {
      if (withStyles && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        const html = pages
          .map(
            (page) =>
              `<section>${generateHTML(page.content, DOCUMENT_MAKER_EXTENSIONS)}</section>`,
          )
          .join("<hr>");
        const clipboardItem = new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        });
        await navigator.clipboard.write([clipboardItem]);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("Clipboard access is unavailable in this browser.");
      }
      setMessage(withStyles ? "Document copied with styles." : "Text copied.");
      setCopied(true);
    } catch (error) {
      console.error("Could not copy the document to the clipboard:", error);
      setMessage("Could not copy. Check clipboard permissions and try again.");
    }
  };

  const downloadDocument = async () => {
    if (!pages.some(hasDocumentContent)) {
      setMessage("Write something before downloading.");
      return;
    }

    setIsDownloading(true);
    setMessage("");
    try {
      const pdf = await generateDocumentMakerPdf(pages, layout);
      const safeName = sanitizeDocumentFileName(exportFileName || documentTitle);
      const saved = await savePDF(pdf, `${safeName}.pdf`);
      setMessage(saved ? "PDF downloaded." : "Download cancelled.");
    } catch (error) {
      console.error("Could not export the document as PDF:", error);
      setMessage(error instanceof Error ? `Could not create the PDF: ${error.message}` : "Could not create the PDF. Try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadDocx = async () => {
    if (!pages.some(hasDocumentContent)) {
      setMessage("Write something before exporting.");
      return;
    }

    setIsDownloading(true);
    setMessage("");
    try {
      const blob = await exportDocumentMakerDocx(
        pages,
        layout,
        documentTitle.trim() || DEFAULT_DOCUMENT_TITLE,
      );
      const safeName = sanitizeDocumentFileName(exportFileName || documentTitle);
      const filename = `${safeName}.docx`;
      let saved: boolean;
      if (window.desktopAPI?.saveDocx) {
        saved = !(await window.desktopAPI.saveDocx(
            new Uint8Array(await blob.arrayBuffer()),
            filename,
          )).canceled;
      } else {
        downloadBlob(blob, filename);
        saved = true;
      }
      setMessage(saved ? "Word document downloaded." : "Download cancelled.");
    } catch (error) {
      console.error("Could not export the document as DOCX:", error);
      setMessage(error instanceof Error ? `Could not export Word document: ${error.message}` : "Could not export the Word document.");
    } finally {
      setIsDownloading(false);
    }
  };

  const findNextText = (search: string) => {
    const needle = search.toLocaleLowerCase();
    if (!needle) return;
    const currentPageIndex = pages.findIndex((page) => page.id === activePageId);
    for (let offset = 0; offset < pages.length; offset += 1) {
      const pageIndex = (currentPageIndex + offset) % pages.length;
      const page = pages[pageIndex];
      const editor = editorByPage.current.get(page.id);
      if (!editor) continue;

      const ranges: Array<{ from: number; to: number }> = [];
      editor.state.doc.descendants((node, position) => {
        if (!node.isText || !node.text) return;
        const text = node.text.toLocaleLowerCase();
        let index = 0;
        while ((index = text.indexOf(needle, index)) >= 0) {
          ranges.push({ from: position + index, to: position + index + needle.length });
          index += needle.length;
        }
      });
      if (!ranges.length) continue;
      const currentFrom = editor.state.selection.from;
      const match = page.id === activePageId
        ? ranges.find(({ from }) => from >= editor.state.selection.to) ?? ranges[0]
        : ranges[0];
      if (page.id === activePageId && match.from === currentFrom && ranges.length > 1) {
        const next = ranges.find(({ from }) => from > currentFrom);
        if (next) {
          activatePage(page.id);
          editor.commands.setTextSelection(next);
          editor.commands.focus();
          return;
        }
      }
      activatePage(page.id);
      editor.commands.setTextSelection(match);
      editor.commands.focus();
      return;
    }
    setMessage(`No matches found for "${search}".`);
  };

  const replaceSelection = (search: string, replacement: string) => {
    if (!activeEditor) return;
    const { from, to } = activeEditor.state.selection;
    const selected = activeEditor.state.doc.textBetween(from, to, "\n");
    if (selected.toLocaleLowerCase() !== search.toLocaleLowerCase()) {
      findNextText(search);
      return;
    }
    activeEditor.chain().focus().insertContentAt({ from, to }, replacement).run();
    setMessage("Match replaced.");
    findNextText(search);
  };

  const replaceAllText = (search: string, replacement: string) => {
    const needle = search.toLocaleLowerCase();
    if (!needle) return;
    let replacedCount = 0;
    for (const page of pages) {
      const editor = editorByPage.current.get(page.id);
      if (!editor) continue;
      const ranges: Array<{ from: number; to: number }> = [];
      editor.state.doc.descendants((node, position) => {
        if (!node.isText || !node.text) return;
        const text = node.text.toLocaleLowerCase();
        let index = 0;
        while ((index = text.indexOf(needle, index)) >= 0) {
          ranges.push({ from: position + index, to: position + index + needle.length });
          index += needle.length;
        }
      });
      let transaction = editor.state.tr;
      for (const range of ranges.reverse()) {
        transaction = transaction.insertText(replacement, range.from, range.to);
        replacedCount += 1;
      }
      if (ranges.length > 0) editor.view.dispatch(transaction);
    }
    setMessage(`${replacedCount} match${replacedCount === 1 ? "" : "es"} replaced.`);
  };

  useEffect(() => {
    const handleDocumentShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFindReplaceOpen(true);
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveCurrentDocument();
      }
    };
    window.addEventListener("keydown", handleDocumentShortcut);
    return () => window.removeEventListener("keydown", handleDocumentShortcut);
  }, [saveCurrentDocument]);

  const insertImage = async (file?: File) => {
    if (!file || !activeEditor) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Choose a valid image file.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setMessage("Choose an image smaller than 20 MB.");
      return;
    }

    try {
      const source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read the selected image."));
        reader.onload = () => {
          if (typeof reader.result !== "string") {
            reject(new Error("The selected image could not be loaded."));
            return;
          }
          resolve(reader.result);
        };
        reader.readAsDataURL(file);
      });
      const normalizedImage = await new Promise<{ source: string; width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onerror = () => reject(new Error("The selected image format could not be decoded."));
        image.onload = () => {
          const scale = Math.min(1, 3000 / image.naturalWidth, 3000 / image.naturalHeight);
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error("Image processing is unavailable."));
            return;
          }
          context.drawImage(image, 0, 0);
          resolve({
            source: canvas.toDataURL("image/png"),
            width: canvas.width,
            height: canvas.height,
          });
        };
        image.src = source;
      });
      const pageDimensions = getDocumentMakerPageDimensions(layout);
      const insets = getDocumentMakerContentInsets(layout);
      const horizontalMargins = (layout.margins.left + layout.margins.right) * 96 / 25.4;
      const verticalMargins =
        (layout.margins.top + layout.margins.bottom) * 96 / 25.4 +
        insets.topPx +
        insets.bottomPx;
      const scaleToPage = Math.min(
        1,
        (pageDimensions.widthPx - horizontalMargins) / normalizedImage.width,
        (pageDimensions.heightPx - verticalMargins) / normalizedImage.height,
      );
      activeEditor
        .chain()
        .focus()
        .setImage({
          src: normalizedImage.source,
          alt: file.name,
          width: Math.round(normalizedImage.width * scaleToPage),
          height: Math.round(normalizedImage.height * scaleToPage),
        })
        .run();
      setMessage("");
    } catch (error) {
      console.error("Could not insert the selected image:", error);
      setMessage("Could not insert that image. Try another file.");
    }
  };

  const uploadFont = async (file?: File) => {
    if (!file || !activeEditor) return;
    if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) {
      setMessage("Choose a TTF, OTF, WOFF, or WOFF2 font file.");
      return;
    }

    const family = getDocumentMakerFontFamily(file.name);
    if (!family) {
      setMessage("The font filename must contain letters or numbers.");
      return;
    }

    try {
      const font: UploadedDocumentFont = { family, data: await file.arrayBuffer() };
      await registerDocumentMakerFont(font);
      await saveUploadedDocumentFont(font);
      setUploadedFonts((current) => [
        ...current.filter((savedFont) => savedFont.family !== family),
        font,
      ]);
      activeEditor.chain().focus().setFontFamily(family).run();
      setMessage(`Font "${family}" uploaded and saved on this device.`);
    } catch (error) {
      console.error("Could not upload the selected font:", error);
      setMessage("Could not load or save that font. Check that the file is a valid font.");
    }
  };

  const applyAlignment = (alignment: "left" | "center" | "right" | "justify") => {
    activeEditor?.chain().focus().setTextAlign(alignment).run();
  };
  const currentTextColor =
    activeEditor?.getAttributes("textStyle").color ?? textColor;
  const applyTextColor = (color: string) => {
    setTextColor(color);
    activeEditor?.chain().focus().setColor(color).run();
  };
  const resetTextColor = () => {
    setTextColor("#000000");
    activeEditor?.chain().focus().unsetColor().run();
  };
  const textColorPicker = (
    <TextColorPicker
      color={currentTextColor}
      disabled={!activeEditor}
      onChange={applyTextColor}
      onReset={resetTextColor}
      onError={setMessage}
    />
  );

  const setLink = () => {
    if (!activeEditor) return;
    const selection = activeEditor.state.selection;
    const currentHref = activeEditor.getAttributes("link").href as string | undefined;
    linkSelectionRef.current = {
      editor: activeEditor,
      from: selection.from,
      to: selection.to,
    };
    setLinkHref(currentHref ?? "");
    setLinkIsEditing(Boolean(currentHref));
    setLinkError("");
    setLinkDialogOpen(true);
  };

  const closeLinkDialog = () => {
    const savedSelection = linkSelectionRef.current;
    setLinkDialogOpen(false);
    setLinkError("");
    if (savedSelection) {
      savedSelection.editor
        .chain()
        .focus()
        .setTextSelection({
          from: savedSelection.from,
          to: savedSelection.to,
        })
        .run();
    }
    linkSelectionRef.current = null;
  };

  const removeLink = () => {
    const savedSelection = linkSelectionRef.current;
    if (!savedSelection) {
      setLinkError("Select linked text in the document before removing its link.");
      return;
    }
    const applied = savedSelection.editor
      .chain()
      .focus()
      .setTextSelection({
        from: savedSelection.from,
        to: savedSelection.to,
      })
      .unsetLink()
      .run();
    if (!applied) {
      setLinkError("Could not remove the link from the selected text.");
      return;
    }
    linkSelectionRef.current = null;
    setLinkDialogOpen(false);
    setLinkError("");
    setMessage("");
  };

  const applyLink = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const href = linkHref.trim();
    const savedSelection = linkSelectionRef.current;
    if (!savedSelection) {
      setLinkError("Select text in the document before adding a link.");
      return;
    }
    if (!href) {
      setLinkError("Enter a complete web address beginning with https:// or http://.");
      return;
    }
    if (!/^https?:\/\/\S+$/i.test(href)) {
      setLinkError("Enter a complete web address beginning with https:// or http://.");
      return;
    }
    const applied = savedSelection.editor
      .chain()
      .focus()
      .setTextSelection({
        from: savedSelection.from,
        to: savedSelection.to,
      })
      .setLink({ href })
      .run();
    if (!applied) {
      setLinkError("Could not apply the link to the selected text.");
      return;
    }
    linkSelectionRef.current = null;
    setLinkDialogOpen(false);
    setLinkError("");
    setMessage("");
  };

  const refreshDocumentLibrary = async () => {
    try {
      setSavedDocuments(await listSavedDocumentMakerDocuments());
      setLibraryOpen(true);
    } catch (error) {
      console.error("Could not refresh the saved document library:", error);
      setMessage("Could not open your saved documents.");
    }
  };

  const currentAlignment = (["left", "center", "right", "justify"] as const).find(
    (alignment) => activeEditor?.isActive({ textAlign: alignment }),
  ) ?? "left";
  const currentFontSize = activeEditor?.getAttributes("textStyle").fontSize ?? "16px";
  const currentFontSizeValue = Number.parseFloat(currentFontSize) || 16;
  const applyFontSize = (size: string) => {
    if (!activeEditor) return;
    if (size === "16px") {
      activeEditor.chain().focus().unsetFontSize().run();
    } else {
      activeEditor.chain().focus().setFontSize(size).run();
    }
  };
  const changeFontSize = (direction: -1 | 1) => {
    const nextSize = direction > 0
      ? FONT_SIZES.find((size) => Number.parseFloat(size) > currentFontSizeValue)
      : [...FONT_SIZES]
        .reverse()
        .find((size) => Number.parseFloat(size) < currentFontSizeValue);
    if (nextSize) applyFontSize(nextSize);
  };
  const currentFontFamily = activeEditor?.getAttributes("textStyle").fontFamily ?? "";
  const languageFonts = [
    ...new Set([
      ...LANGUAGE_FONT_FAMILIES[language],
      ...(language === "english" ? [] : bundledFonts[language] ?? []),
    ]),
  ];
  const fontGroupLabel =
    language === "english"
      ? "Common system fonts"
      : `${language === "bengali" ? "Bangla" : "Hindi"} fonts`;
  const fontOptions: DropdownOption[] = [{ value: "default", label: "Default font" }];
  const knownFontFamilies = new Set<string>();
  const appendFontGroup = (label: string, families: string[]) => {
    const newFamilies = families.filter((family) => !knownFontFamilies.has(family));
    if (newFamilies.length === 0) return;
    fontOptions.push({ value: `group-${label}`, label, groupHeader: true });
    for (const family of newFamilies) {
      knownFontFamilies.add(family);
      fontOptions.push({ value: family, label: family });
    }
  };
  if (currentFontFamily && ![
    ...languageFonts,
    ...uploadedFonts.map(({ family }) => family),
  ].includes(currentFontFamily)) {
    fontOptions.push({ value: currentFontFamily, label: currentFontFamily });
    knownFontFamilies.add(currentFontFamily);
  }
  appendFontGroup(fontGroupLabel, languageFonts);
  appendFontGroup("Uploaded fonts", uploadedFonts.map(({ family }) => family));
  const applyFontFamily = (value: string) => {
    if (!activeEditor) return;
    if (value === "default") {
      activeEditor.chain().focus().unsetFontFamily().run();
    } else {
      activeEditor.chain().focus().setFontFamily(value).run();
    }
  };
  const insertConfiguredTable = () => {
    activeEditor?.chain().focus().insertTable({
      rows: tableRows,
      cols: tableColumns,
      withHeaderRow: true,
    }).run();
    setTablePickerOpen(false);
  };

  useLayoutEffect(() => {
    if (!tablePickerOpen) {
      setTablePickerPosition(null);
      return;
    }

    const updatePosition = () => {
      const anchor = tablePickerAnchorRef.current?.getBoundingClientRect();
      const picker = tablePickerRef.current?.getBoundingClientRect();
      if (!anchor || !picker) return;

      const left = Math.max(
        8,
        Math.min(anchor.left, window.innerWidth - picker.width - 8),
      );
      const below = anchor.bottom + 4;
      const top =
        below + picker.height <= window.innerHeight - 8
          ? below
          : Math.max(8, anchor.top - picker.height - 4);
      setTablePickerPosition({ left, top });
    };

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !tablePickerAnchorRef.current?.contains(target) &&
        !tablePickerRef.current?.contains(target)
      ) {
        setTablePickerOpen(false);
      }
    };

    updatePosition();
    document.addEventListener("pointerdown", handleOutsidePointerDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [tablePickerOpen]);

  const compactFontPicker = (
    <Dropdown
      aria-label={`Font family (${language})`}
      value={currentFontFamily || "default"}
      disabled={!activeEditor}
      onChange={applyFontFamily}
      options={fontOptions}
      className="w-full px-2"
    />
  );
  const tinyToolbarTools = (
    <>
      <div className="flex items-center gap-1">
        <ToolbarButton
          label="Undo"
          disabled={!activeEditor?.can().undo()}
          onClick={() => activeEditor?.chain().focus().undo().run()}
          className="document-maker-toolbar-history"
        >
          <Undo2 className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          disabled={!activeEditor?.can().redo()}
          onClick={() => activeEditor?.chain().focus().redo().run()}
          className="document-maker-toolbar-history"
        >
          <Redo2 className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
      </div>
      <div className="flex h-8 items-stretch overflow-hidden rounded-lg border border-ui bg-surface">
        <button
          type="button"
          aria-label="Decrease font size"
          disabled={!activeEditor || currentFontSizeValue <= Number.parseFloat(FONT_SIZES[0])}
          onClick={() => changeFontSize(-1)}
          className="flex w-8 items-center justify-center text-ink-secondary hover:bg-surface-subtle disabled:opacity-40"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <Dropdown
          aria-label="Font size"
          value={currentFontSize}
          disabled={!activeEditor}
          onChange={applyFontSize}
          options={FONT_SIZES.map((size) => ({
            value: size,
            label: String(Number.parseInt(size, 10)),
          }))}
          className="!h-full !w-20 !gap-4 !rounded-none !border-x !border-y-0 !border-ui !bg-transparent !px-2 [&>span]:text-center"
        />
        <button
          type="button"
          aria-label="Increase font size"
          disabled={!activeEditor || currentFontSizeValue >= Number.parseFloat(FONT_SIZES[FONT_SIZES.length - 1])}
          onClick={() => changeFontSize(1)}
          className="flex w-8 items-center justify-center text-ink-secondary hover:bg-surface-subtle disabled:opacity-40"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </>
  );
  const moreToolbarItems: ToolbarMenuItem[] = [
    {
      label: "Upload font",
      icon: <Upload className="h-4 w-4" aria-hidden="true" />,
      disabled: !activeEditor,
      onSelect: () => fontInputRef.current?.click(),
    },
    ...(language === "english"
      ? [
          {
            label: "Spell check",
            icon: <SpellCheck className="h-4 w-4" aria-hidden="true" />,
            active: spellCheck,
            checkbox: true,
            onSelect: () => setSpellCheck((enabled) => !enabled),
          },
          {
            label: "Autocorrect",
            icon: <WandSparkles className="h-4 w-4" aria-hidden="true" />,
            active: autoCorrect,
            checkbox: true,
            onSelect: () => setAutoCorrect((enabled) => !enabled),
          },
        ]
      : []),
    {
      label: "Find and replace",
      icon: <Search className="h-4 w-4" aria-hidden="true" />,
      onSelect: () => setFindReplaceOpen(true),
    },
  ];
  const compactMoreToolbarItems: ToolbarMenuItem[] = [
    {
      label: "Insert or edit link",
      icon: <Link2 className="h-4 w-4" aria-hidden="true" />,
      disabled: !activeEditor,
      compactOnly: true,
      onSelect: setLink,
    },
    {
      label: "Highlight",
      icon: <Highlighter className="h-4 w-4" aria-hidden="true" />,
      active: Boolean(activeEditor?.isActive("highlight")),
      checkbox: true,
      disabled: !activeEditor,
      compactOnly: true,
      onSelect: () => activeEditor?.chain().focus().toggleHighlight().run(),
    },
  ];
  const previewHtml = useMemo(
    () => createDocumentMakerPreviewHtml(pages, layout),
    [layout, pages],
  );

  return (
    <main className="document-maker flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface-muted">
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-1 flex-col px-3 py-3 sm:px-6 sm:py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <BackToToolsButton onClick={onClose} toolName="Document Maker" />
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <InputField
              aria-label="Document title"
              value={documentTitle}
              onChange={(event) => setDocumentTitle(event.target.value)}
              className="w-44 rounded-lg border border-ui bg-surface px-3 py-2 text-sm font-semibold text-ink-primary"
            />
            <AutoSaveStatusIndicator
              status={autoSave.status}
              lastSavedAt={autoSave.lastSavedAt}
              onRetry={autoSave.retry}
            />
            <button type="button" onClick={() => void saveCurrentDocument()} disabled={!autoSave.isLoaded} className="rounded-lg border border-ui bg-surface px-3 py-2 text-xs font-semibold text-ink-secondary hover:bg-surface-muted disabled:opacity-40">
              Save
            </button>
            <button type="button" onClick={() => void refreshDocumentLibrary()} className="rounded-lg border border-ui bg-surface px-3 py-2 text-xs font-semibold text-ink-secondary hover:bg-surface-muted">
              Documents
            </button>
            <button type="button" onClick={() => setTemplatesOpen(true)} className="rounded-lg border border-ui bg-surface px-3 py-2 text-xs font-semibold text-ink-secondary hover:bg-surface-muted">
              Templates
            </button>
            <button type="button" onClick={() => docxInputRef.current?.click()} disabled={docxImporting} className="rounded-lg border border-ui bg-surface px-3 py-2 text-xs font-semibold text-ink-secondary hover:bg-surface-muted disabled:opacity-40">
              {docxImporting ? "Importing…" : "Open Word"}
            </button>
            <button type="button" onClick={() => setLayoutOpen(true)} className="rounded-lg border border-ui bg-surface px-3 py-2 text-xs font-semibold text-ink-secondary hover:bg-surface-muted">
              <span className="inline-flex items-center gap-1"><Settings2 className="h-3.5 w-3.5" aria-hidden="true" />Page layout</span>
            </button>
          </div>
          <input
            ref={docxInputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            aria-label="Choose Word document to import"
            onChange={(event) => {
              void importDocxFile(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </div>

        <section className="document-maker-print-area flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-2xl border border-ui bg-surface shadow-sm">
          <div className="document-maker-toolbar flex flex-nowrap items-center gap-1 border-b border-ui bg-surface-muted px-2 py-1.5">
            <div className="document-maker-toolbar-controls flex min-w-0 flex-1 flex-nowrap items-center gap-1">
            <ToolbarButton
              label="Undo"
              disabled={!activeEditor?.can().undo()}
              onClick={() => activeEditor?.chain().focus().undo().run()}
              className="document-maker-toolbar-history"
            >
              <Undo2 className="h-4 w-4" aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              label="Redo"
              disabled={!activeEditor?.can().redo()}
              onClick={() => activeEditor?.chain().focus().redo().run()}
              className="document-maker-toolbar-history"
            >
              <Redo2 className="h-4 w-4" aria-hidden="true" />
            </ToolbarButton>
            <span className="document-maker-toolbar-font-divider mx-1 h-6 w-px bg-ui" aria-hidden="true" />
            <Dropdown
              aria-label={`Font family (${language})`}
              value={currentFontFamily || "default"}
              disabled={!activeEditor}
              onChange={applyFontFamily}
              options={fontOptions}
              className="document-maker-toolbar-font-family !w-44 max-w-full shrink-0 px-2"
            />
            <input
              ref={fontInputRef}
              type="file"
              accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
              className="hidden"
              aria-label="Choose font file to upload"
              onChange={(event) => {
                void uploadFont(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
            <ToolbarButton
              label="Upload font"
              disabled={!activeEditor}
              onClick={() => fontInputRef.current?.click()}
              className="document-maker-toolbar-optional"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
            </ToolbarButton>
            <div className="document-maker-toolbar-font-size inline-flex h-9 shrink-0 items-stretch overflow-hidden rounded-lg border border-ui bg-surface">
              <button
                type="button"
                aria-label="Decrease font size"
                disabled={!activeEditor || currentFontSizeValue <= Number.parseFloat(FONT_SIZES[0])}
                onClick={() => changeFontSize(-1)}
                className="flex w-9 items-center justify-center text-ink-secondary transition-colors hover:bg-surface-subtle hover:text-ink-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <Dropdown
                aria-label="Font size"
                value={currentFontSize}
                disabled={!activeEditor}
                onChange={applyFontSize}
                options={FONT_SIZES.map((size) => ({
                  value: size,
                  label: String(Number.parseInt(size, 10)),
                }))}
                className="!h-full !w-20 !gap-4 !rounded-none !border-x !border-y-0 !border-ui !bg-transparent !px-2 [&>span]:text-center"
              />
              <button
                type="button"
                aria-label="Increase font size"
                disabled={!activeEditor || currentFontSizeValue >= Number.parseFloat(FONT_SIZES[FONT_SIZES.length - 1])}
                onClick={() => changeFontSize(1)}
                className="flex w-9 items-center justify-center text-ink-secondary transition-colors hover:bg-surface-subtle hover:text-ink-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <span className="document-maker-toolbar-size-divider mx-1 h-6 w-px bg-ui" aria-hidden="true" />
            <ToolbarButton
              label="Bold"
              active={Boolean(activeEditor?.isActive("bold"))}
              onClick={() => activeEditor?.chain().focus().toggleBold().run()}
            >
              <Bold className="h-4 w-4" aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              label="Italic"
              active={Boolean(activeEditor?.isActive("italic"))}
              onClick={() => activeEditor?.chain().focus().toggleItalic().run()}
            >
              <Italic className="h-4 w-4" aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              label="Underline"
              active={Boolean(activeEditor?.isActive("underline"))}
              onClick={() => activeEditor?.chain().focus().toggleUnderline().run()}
            >
              <UnderlineIcon className="h-4 w-4" aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              label="Insert or edit link"
              disabled={!activeEditor}
              active={Boolean(activeEditor?.isActive("link"))}
              preserveSelection
              onClick={setLink}
              className="document-maker-toolbar-secondary"
            >
              <Link2 className="h-4 w-4" aria-hidden="true" />
            </ToolbarButton>
            <TextColorPicker
              color={currentTextColor}
              disabled={!activeEditor}
              className="document-maker-toolbar-secondary"
              onChange={applyTextColor}
              onReset={resetTextColor}
              onError={setMessage}
            />
            <ToolbarButton
              label="Highlight"
              disabled={!activeEditor}
              active={Boolean(activeEditor?.isActive("highlight"))}
              onClick={() => activeEditor?.chain().focus().toggleHighlight().run()}
              className="document-maker-toolbar-secondary"
            >
              <Highlighter className="h-4 w-4" aria-hidden="true" />
            </ToolbarButton>
            <span className="document-maker-toolbar-secondary-divider mx-1 h-6 w-px bg-ui" aria-hidden="true" />
            <ToolbarDropdown
              label="Text alignment"
              icon={
                currentAlignment === "center" ? (
                  <AlignCenter className="h-4 w-4" aria-hidden="true" />
                ) : currentAlignment === "right" ? (
                  <AlignRight className="h-4 w-4" aria-hidden="true" />
                ) : currentAlignment === "justify" ? (
                  <AlignJustify className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <AlignLeft className="h-4 w-4" aria-hidden="true" />
                )
              }
              open={openToolbarMenu === "alignment"}
              onToggle={() =>
                setOpenToolbarMenu((current) =>
                  current === "alignment" ? null : "alignment",
                )
              }
              onClose={() => setOpenToolbarMenu(null)}
              items={[
                {
                  label: "Align left",
                  icon: <AlignLeft className="h-4 w-4" aria-hidden="true" />,
                  active: currentAlignment === "left",
                  onSelect: () => applyAlignment("left"),
                },
                {
                  label: "Align center",
                  icon: <AlignCenter className="h-4 w-4" aria-hidden="true" />,
                  active: currentAlignment === "center",
                  onSelect: () => applyAlignment("center"),
                },
                {
                  label: "Align right",
                  icon: <AlignRight className="h-4 w-4" aria-hidden="true" />,
                  active: currentAlignment === "right",
                  onSelect: () => applyAlignment("right"),
                },
                {
                  label: "Justify",
                  icon: <AlignJustify className="h-4 w-4" aria-hidden="true" />,
                  active: currentAlignment === "justify",
                  onSelect: () => applyAlignment("justify"),
                },
              ]}
            />
            <ToolbarDropdown
              label="Lists"
              icon={
                activeEditor?.isActive("orderedList") ? (
                  <ListOrdered className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <List className="h-4 w-4" aria-hidden="true" />
                )
              }
              open={openToolbarMenu === "list"}
              onToggle={() =>
                setOpenToolbarMenu((current) => (current === "list" ? null : "list"))
              }
              onClose={() => setOpenToolbarMenu(null)}
              items={[
                {
                  label: "Bulleted list",
                  icon: <List className="h-4 w-4" aria-hidden="true" />,
                  active: Boolean(activeEditor?.isActive("bulletList")),
                  onSelect: () => activeEditor?.chain().focus().toggleBulletList().run(),
                },
                {
                  label: "Numbered list",
                  icon: <ListOrdered className="h-4 w-4" aria-hidden="true" />,
                  active: Boolean(activeEditor?.isActive("orderedList")),
                  onSelect: () => activeEditor?.chain().focus().toggleOrderedList().run(),
                },
                {
                  label: "Turn off list",
                  icon: <span className="text-sm" aria-hidden="true">1.</span>,
                  active: false,
                  onSelect: () => {
                    if (activeEditor?.isActive("bulletList")) {
                      activeEditor.chain().focus().toggleBulletList().run();
                    } else if (activeEditor?.isActive("orderedList")) {
                      activeEditor.chain().focus().toggleOrderedList().run();
                    }
                  },
                },
              ]}
            />
            {language === "english" && (
              <span className="document-maker-toolbar-optional">
              <ToolbarDropdown
                label="Proofing"
                icon={<SpellCheck className="h-4 w-4" aria-hidden="true" />}
                open={openToolbarMenu === "proofing"}
                onToggle={() =>
                  setOpenToolbarMenu((current) =>
                    current === "proofing" ? null : "proofing",
                  )
                }
                onClose={() => setOpenToolbarMenu(null)}
                items={[
                  {
                    label: "Spell check",
                    icon: <SpellCheck className="h-4 w-4" aria-hidden="true" />,
                    active: spellCheck,
                    onSelect: () => setSpellCheck((enabled) => !enabled),
                  },
                  {
                    label: "Autocorrect",
                    icon: <WandSparkles className="h-4 w-4" aria-hidden="true" />,
                    active: autoCorrect,
                    onSelect: () => setAutoCorrect((enabled) => !enabled),
                  },
                ]}
              />
              </span>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Choose image to insert"
              onChange={(event) => {
                void insertImage(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
            <ToolbarButton
              label="Insert image"
              disabled={!activeEditor}
              onClick={() => imageInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
            </ToolbarButton>
            <div ref={tablePickerAnchorRef} className="relative">
              <ToolbarButton
                label="Insert table"
                disabled={!activeEditor}
                active={tablePickerOpen}
                onClick={() => setTablePickerOpen((open) => !open)}
              >
                <Table2 className="h-4 w-4" aria-hidden="true" />
              </ToolbarButton>
              {tablePickerOpen &&
                createPortal(
                  <div
                    ref={tablePickerRef}
                    role="dialog"
                    aria-label="Insert table size"
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setTablePickerOpen(false);
                    }}
                    className="fixed z-50 w-48 rounded-xl border border-ui bg-surface p-2.5 shadow-lg"
                    style={{
                      left: tablePickerPosition?.left ?? 0,
                      top: tablePickerPosition?.top ?? 0,
                      visibility: tablePickerPosition ? "visible" : "hidden",
                    }}
                  >
                    {([
                      { label: "Columns", value: tableColumns, setValue: setTableColumns },
                      { label: "Rows", value: tableRows, setValue: setTableRows },
                    ] as const).map(({ label, value, setValue }) => (
                      <div
                        key={label}
                        className="flex items-center justify-between border-b border-ui py-1.5 last:mb-2"
                      >
                        <span className="text-sm text-ink-primary">{label}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Decrease ${label.toLowerCase()}`}
                            disabled={value <= 1}
                            onClick={() => setValue((count) => Math.max(1, count - 1))}
                            className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-secondary hover:bg-surface-muted disabled:opacity-40"
                          >
                            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <output className="w-5 text-center text-sm tabular-nums text-ink-primary">
                            {value}
                          </output>
                          <button
                            type="button"
                            aria-label={`Increase ${label.toLowerCase()}`}
                            disabled={value >= 20}
                            onClick={() => setValue((count) => Math.min(20, count + 1))}
                            className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-secondary hover:bg-surface-muted disabled:opacity-40"
                          >
                            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={insertConfiguredTable}
                      className="mt-1 flex h-9 w-full items-center justify-center rounded-lg bg-action px-3 text-sm font-semibold text-ink-inverse hover:bg-action-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-action"
                    >
                      Insert table
                    </button>
                  </div>,
                  document.body,
                )}
            </div>
            <ToolbarButton
              label="Find and replace"
              onClick={() => setFindReplaceOpen(true)}
              className="document-maker-toolbar-optional"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </ToolbarButton>
            </div>
            <MoreToolbarMenu
              open={openToolbarMenu === "more"}
              onToggle={() =>
                setOpenToolbarMenu((current) => current === "more" ? null : "more")
              }
              onClose={() => setOpenToolbarMenu(null)}
              items={moreToolbarItems}
              compactItems={compactMoreToolbarItems}
              tinyTools={tinyToolbarTools}
              fontPicker={compactFontPicker}
              textColorPicker={textColorPicker}
            />
            <ToolbarButton
              label={isDownloading ? "Creating export" : "Preview and export"}
              disabled={isDownloading || !autoSave.isLoaded}
              onClick={() => {
                setExportFileName(documentTitle);
                setExportOpen(true);
              }}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
            </ToolbarButton>
          </div>

          <div className="document-maker-workspace grid min-h-[520px] flex-1 grid-cols-1 grid-rows-[auto_minmax(420px,1fr)] sm:min-h-0 sm:grid-cols-[190px_minmax(0,1fr)] sm:grid-rows-1">
            <aside className="document-maker-page-list flex min-h-[100px] flex-col border-b border-ui bg-surface-muted sm:min-h-0 sm:border-b-0 sm:border-r">
              <div className="flex items-center justify-between gap-2 border-b border-ui px-3 py-2">
                <span className="text-xs font-semibold text-ink-strong">
                  Pages <span className="text-ink-muted">({pages.length})</span>
                </span>
                <button
                  type="button"
                  aria-label="Add page"
                  title="Add page"
                  onClick={() => addPageAfter(pages.findIndex((page) => page.id === activePageId))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-action hover:bg-action-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-action"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div
                className="scrollbar-hidden flex max-h-36 min-h-0 gap-2 overflow-auto p-2 sm:max-h-none sm:flex-1 sm:flex-col"
                role="list"
                aria-label="Document pages"
              >
                {pages.map((page, index) => {
                  const preview = getPagePreview(page);
                  return (
                    <div className="relative flex min-w-36 sm:min-w-0" key={page.id} role="listitem">
                      <button
                        type="button"
                        aria-current={page.id === activePageId ? "location" : undefined}
                        onClick={() => activatePage(page.id)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          togglePageMenu(page.id, {
                            left: event.clientX,
                            right: event.clientX,
                            top: event.clientY,
                            bottom: event.clientY,
                          });
                        }}
                        className={`min-h-[68px] min-w-0 flex-1 rounded-xl border p-2.5 pr-9 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-action ${
                          page.id === activePageId
                            ? "border-action-border-strong bg-action-subtle"
                            : "border-ui bg-surface hover:border-ui-strong"
                        }`}
                      >
                        <span className="block text-xs font-semibold text-ink-strong">
                          Page {index + 1}
                        </span>
                        <span className="mt-1 block truncate text-[11px] text-ink-muted">
                          {preview || "Empty page"}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Page ${index + 1} options`}
                        aria-haspopup="menu"
                        aria-expanded={pageMenu?.pageId === page.id}
                        onClick={(event) =>
                          togglePageMenu(
                            page.id,
                            event.currentTarget.getBoundingClientRect(),
                          )
                        }
                        className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-surface-subtle hover:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-action"
                      >
                        <MoreVertical className="h-4 w-4" aria-hidden="true" />
                      </button>
                      {pageMenu?.pageId === page.id && (
                        <div
                          className="fixed z-50 w-48 rounded-xl border border-ui bg-surface p-1.5 shadow-xl"
                          role="menu"
                          aria-label={`Page ${index + 1} options`}
                          style={{ left: pageMenu.left, top: pageMenu.top }}
                        >
                          {confirmDeletePageId === page.id ? (
                            <div className="space-y-2 p-2">
                              <p className="text-xs text-ink-strong">
                                Delete this page and its text?
                              </p>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePageId(null)}
                                  className="rounded px-2 py-1 text-xs text-ink-secondary hover:bg-surface-subtle"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deletePage(index)}
                                  className="rounded bg-error-hover px-2 py-1 text-xs font-semibold text-ink-inverse hover:bg-error"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => addPageAfter(index)}
                                className="flex min-h-8 w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-ink-strong hover:bg-surface-subtle"
                              >
                                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                                Add page after
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => addPageAfter(index, true)}
                                className="flex min-h-8 w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-ink-strong hover:bg-surface-subtle"
                              >
                                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                Duplicate page
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                disabled={index === 0}
                                onClick={() => movePage(index, -1)}
                                className="flex min-h-8 w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-ink-strong hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                                Move page up
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                disabled={index === pages.length - 1}
                                onClick={() => movePage(index, 1)}
                                className="flex min-h-8 w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-ink-strong hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                                Move page down
                              </button>
                              <div className="my-1 border-t border-ui-subtle" />
                              <button
                                type="button"
                                role="menuitem"
                                disabled={pages.length <= 1}
                                onClick={() => setConfirmDeletePageId(page.id)}
                                className="flex min-h-8 w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-error-hover hover:bg-error-subtle disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                Delete page
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </aside>

            <div className="document-maker-pages scrollbar-hidden min-h-[420px] overflow-auto bg-surface-muted p-3 sm:p-6">
              {pages.map((page, index) => (
                <DocumentMakerPageEditor
                  key={page.id}
                  page={page}
                  pageNumber={index + 1}
                  active={page.id === activePageId}
                  autoFocusAtEnd={page.id === autoFocusPageId}
                  layout={layout}
                  language={language}
                  spellCheck={spellCheck}
                  autoCorrect={autoCorrect}
                  onContentChange={handlePageContentChange}
                  onAutoPage={handleAutoPage}
                  onActivate={activatePage}
                  onSelectionUpdate={handleEditorSelectionUpdate}
                  onEditorReady={handleEditorReady}
                  onAutoPageFocused={handleAutoPageFocused}
                />
              ))}
            </div>
          </div>

          <div className="document-maker-toolbar flex flex-wrap items-center justify-between gap-3 border-t border-ui px-3 py-2.5 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <div
                aria-label="Typing language"
                className="inline-flex items-center rounded-full border border-ui bg-surface p-0.5"
              >
                {LANGUAGES.map(({ id, label, nativeLabel }) => (
                  <button
                    key={id}
                    type="button"
                    aria-label={nativeLabel}
                    aria-pressed={language === id}
                    onClick={() => setLanguage(id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      language === id
                        ? "bg-action-soft text-action"
                        : "text-ink-muted hover:text-ink-primary"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="min-w-0 text-xs text-ink-muted" role="status" aria-live="polite">
                {message}
              </span>
              <div
                className="relative inline-flex"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setCopyMenuOpen(false);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setCopyMenuOpen(false);
                }}
              >
                <button
                  type="button"
                  onClick={() => void copyDocument(true)}
                  className="inline-flex h-9 items-center gap-2 rounded-l-full border border-ui px-3 text-sm font-semibold text-ink-strong transition-colors hover:bg-surface-muted focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-action"
                >
                  {copied ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  aria-label="Copy options"
                  aria-haspopup="menu"
                  aria-expanded={copyMenuOpen}
                  onClick={() => setCopyMenuOpen((open) => !open)}
                  className="inline-flex h-9 items-center rounded-r-full border border-l-0 border-ui px-2 text-ink-secondary transition-colors hover:bg-surface-muted focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-action"
                >
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </button>
                {copyMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Copy options"
                    className="absolute bottom-full right-0 z-40 mb-2 min-w-48 rounded-xl border border-ui bg-surface p-1.5 shadow-lg"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setCopyMenuOpen(false);
                        void copyDocument(false);
                      }}
                      className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-ink-strong hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-action"
                    >
                      <Copy className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Copy text only
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setCopyMenuOpen(false);
                        void copyDocument(true);
                      }}
                      className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-ink-strong hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-action"
                    >
                      <Copy className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Copy with styles
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
      {libraryOpen && (
        <DocumentLibraryDialog
          documents={savedDocuments}
          currentId={currentDocumentId}
          onClose={() => setLibraryOpen(false)}
          onNew={startNewDocument}
          onOpen={openSavedDocument}
          onRename={(saved, title) => void renameSavedDocument(saved, title)}
          onDelete={(saved) => void deleteSavedDocument(saved)}
        />
      )}
      {templatesOpen && (
        <DocumentTemplateDialog
          templates={DOCUMENT_MAKER_TEMPLATES}
          onClose={() => setTemplatesOpen(false)}
          onSelect={applyTemplate}
        />
      )}
      {layoutOpen && (
        <DocumentLayoutDialog
          layout={layout}
          onClose={() => setLayoutOpen(false)}
          onApply={(nextLayout) => {
            setLayout(nextLayout);
            setLayoutOpen(false);
            setMessage("Page layout updated.");
          }}
        />
      )}
      {linkDialogOpen && (
        <DialogFrame
          labelledBy="document-link-title"
          panelClassName="w-full max-w-md rounded-2xl bg-surface p-5 shadow-2xl"
          onBackdropDismiss={closeLinkDialog}
          backdropDismissOn="mouseDown"
        >
          <h2 id="document-link-title" className="mb-4 text-lg font-bold text-ink-primary">
            Insert or edit link
          </h2>
          <form onSubmit={applyLink}>
            <label className="block text-sm font-medium text-ink-secondary" htmlFor="document-link-url">
              Web address
            </label>
            <InputField
              id="document-link-url"
              autoFocus
              type="url"
              required
              value={linkHref}
              onChange={(event) => {
                setLinkHref(event.target.value);
                setLinkError("");
              }}
              placeholder="https://example.com"
              className="mt-1 w-full"
            />
            {linkError && (
              <p role="alert" className="mt-2 text-sm text-danger">
                {linkError}
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {linkIsEditing && (
                <button
                  type="button"
                  onClick={removeLink}
                  className="mr-auto rounded-lg border border-ui px-3 py-2 text-sm font-semibold text-danger hover:bg-surface-subtle"
                >
                  Remove link
                </button>
              )}
              <button
                type="button"
                onClick={closeLinkDialog}
                className="rounded-lg border border-ui px-3 py-2 text-sm font-semibold text-ink-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-action px-3 py-2 text-sm font-semibold text-ink-inverse"
              >
                {linkIsEditing ? "Update link" : "Add link"}
              </button>
            </div>
          </form>
        </DialogFrame>
      )}
      {findReplaceOpen && (
        <DocumentFindReplaceDialog
          onClose={() => setFindReplaceOpen(false)}
          onFindNext={findNextText}
          onReplace={replaceSelection}
          onReplaceAll={replaceAllText}
        />
      )}
      {exportOpen && (
        <DocumentExportDialog
          html={previewHtml}
          pageCount={pages.length}
          fileName={exportFileName}
          isExporting={isDownloading}
          onFileNameChange={setExportFileName}
          onDownloadPdf={() => void downloadDocument()}
          onDownloadDocx={() => void downloadDocx()}
          onClose={() => setExportOpen(false)}
        />
      )}
    </main>
  );
}
