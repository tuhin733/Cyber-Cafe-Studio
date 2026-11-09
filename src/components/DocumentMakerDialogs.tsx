import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FilePlus2,
  FileText,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import type { DocumentMakerLayout } from "../lib/documentMaker";
import type { SavedDocumentMakerDocument } from "../lib/documentMakerStorage";
import type { DocumentMakerTemplate } from "../lib/documentMakerTemplates";
import DialogFrame from "./DialogFrame";
import Dropdown from "./Dropdown";
import InputField from "./InputField";

interface DialogProps {
  onClose: () => void;
}

export function DocumentLibraryDialog({
  documents,
  currentId,
  onClose,
  onNew,
  onOpen,
  onRename,
  onDelete,
}: DialogProps & {
  documents: SavedDocumentMakerDocument[];
  currentId: string;
  onNew: () => void;
  onOpen: (document: SavedDocumentMakerDocument) => void;
  onRename: (document: SavedDocumentMakerDocument, title: string) => void;
  onDelete: (document: SavedDocumentMakerDocument) => void;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  return (
    <DialogFrame
      labelledBy="document-library-title"
      panelClassName="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-surface p-5 shadow-2xl"
      onBackdropDismiss={onClose}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 id="document-library-title" className="text-lg font-bold text-ink-primary">
          Your documents
        </h2>
        <button type="button" aria-label="Close documents" onClick={onClose}>
          <X className="h-5 w-5 text-ink-muted" aria-hidden="true" />
        </button>
      </div>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center gap-2 rounded-lg bg-action px-3 py-2 text-sm font-semibold text-ink-inverse"
        >
          <FilePlus2 className="h-4 w-4" aria-hidden="true" />
          New document
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto">
        {documents.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ui p-6 text-center text-sm text-ink-muted">
            Saved documents will appear here.
          </p>
        ) : documents.map((document) => (
          <article key={document.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-ui p-3">
            <FileText className="h-4 w-4 shrink-0 text-action" aria-hidden="true" />
            {renamingId === document.id ? (
              <form
                className="flex min-w-48 flex-1 gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const title = renameValue.trim();
                  if (title) onRename(document, title);
                  setRenamingId(null);
                }}
              >
                <InputField
                  autoFocus
                  aria-label="Document name"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-ui px-2 py-1 text-sm text-ink-primary"
                />
                <button type="submit" className="text-xs font-semibold text-action">Save</button>
                <button type="button" onClick={() => setRenamingId(null)} className="text-xs text-ink-muted">Cancel</button>
              </form>
            ) : (
              <div className="min-w-48 flex-1">
                <p className="truncate text-sm font-semibold text-ink-primary">{document.title}</p>
                <p className="text-xs text-ink-muted">
                  {new Date(document.updatedAt).toLocaleString()} · {document.pages.length} page{document.pages.length === 1 ? "" : "s"}
                </p>
              </div>
            )}
            <button type="button" onClick={() => onOpen(document)} className="rounded-lg border border-ui px-2.5 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-surface-muted">
              {document.id === currentId ? "Continue" : "Open"}
            </button>
            {renamingId !== document.id && (
              <button
                type="button"
                aria-label={`Rename ${document.title}`}
                onClick={() => {
                  setRenameValue(document.title);
                  setRenamingId(document.id);
                }}
                className="rounded p-1.5 text-ink-muted hover:bg-surface-muted"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              aria-label={`Delete ${document.title}`}
              onClick={() => onDelete(document)}
              className="rounded p-1.5 text-danger hover:bg-danger-subtle"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </article>
        ))}
      </div>
    </DialogFrame>
  );
}

export function DocumentLayoutDialog({
  layout,
  onClose,
  onApply,
}: DialogProps & {
  layout: DocumentMakerLayout;
  onApply: (layout: DocumentMakerLayout) => void;
}) {
  const [draft, setDraft] = useState(layout);
  const setMargin = (side: keyof DocumentMakerLayout["margins"], value: number) =>
    setDraft((current) => ({
      ...current,
      margins: { ...current.margins, [side]: Math.max(0, Math.min(60, value)) },
    }));

  return (
    <DialogFrame
      labelledBy="document-layout-title"
      panelClassName="max-h-[85vh] w-full max-w-xl overflow-auto rounded-2xl bg-surface p-5 shadow-2xl"
      onBackdropDismiss={onClose}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 id="document-layout-title" className="text-lg font-bold text-ink-primary">Page layout</h2>
        <button type="button" aria-label="Close page layout" onClick={onClose}><X className="h-5 w-5 text-ink-muted" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="document-paper-size" className="text-xs font-semibold text-ink-secondary">
            Paper size
          </label>
          <Dropdown
            id="document-paper-size"
            aria-label="Paper size"
            value={draft.paperSize}
            onChange={(value) => setDraft((current) => ({ ...current, paperSize: value as DocumentMakerLayout["paperSize"] }))}
            className="mt-1"
            options={[
              { value: "A4", label: "A4" },
              { value: "Letter", label: "US Letter" },
              { value: "Legal", label: "US Legal" },
            ]}
          />
        </div>
        <div>
          <label htmlFor="document-orientation" className="text-xs font-semibold text-ink-secondary">
            Orientation
          </label>
          <Dropdown
            id="document-orientation"
            aria-label="Orientation"
            value={draft.orientation}
            onChange={(value) => setDraft((current) => ({ ...current, orientation: value as DocumentMakerLayout["orientation"] }))}
            className="mt-1"
            options={[
              { value: "portrait", label: "Portrait" },
              { value: "landscape", label: "Landscape" },
            ]}
          />
        </div>
      </div>
      <fieldset className="mt-4">
        <legend className="text-xs font-semibold text-ink-secondary">Margins (mm)</legend>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {(["top", "right", "bottom", "left"] as const).map((side) => (
            <label key={side} className="text-xs capitalize text-ink-secondary">
              {side}
              <InputField
                type="number"
                min={0}
                max={60}
                value={draft.margins[side]}
                onChange={(event) => setMargin(side, Number(event.target.value))}
                className="mt-1 w-full rounded-lg border border-ui px-3 py-2 text-sm text-ink-primary"
              />
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-4 block text-xs font-semibold text-ink-secondary">
        Header
        <InputField
          value={draft.header}
          onChange={(event) => setDraft((current) => ({ ...current, header: event.target.value }))}
          placeholder="Optional repeated header"
          maxLength={160}
          className="mt-1 w-full rounded-lg border border-ui px-3 py-2 text-sm text-ink-primary"
        />
      </label>
      <label className="mt-3 block text-xs font-semibold text-ink-secondary">
        Footer
        <InputField
          value={draft.footer}
          onChange={(event) => setDraft((current) => ({ ...current, footer: event.target.value }))}
          placeholder="Optional repeated footer"
          maxLength={160}
          className="mt-1 w-full rounded-lg border border-ui px-3 py-2 text-sm text-ink-primary"
        />
      </label>
      <label className="mt-3 flex items-center gap-2 text-sm text-ink-secondary">
        <input
          type="checkbox"
          checked={draft.pageNumbers}
          onChange={(event) => setDraft((current) => ({ ...current, pageNumbers: event.target.checked }))}
        />
        Show page numbers
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-ui px-4 py-2 text-sm text-ink-secondary">Cancel</button>
        <button type="button" onClick={() => onApply(draft)} className="rounded-lg bg-action px-4 py-2 text-sm font-semibold text-ink-inverse">Apply layout</button>
      </div>
    </DialogFrame>
  );
}

export function DocumentTemplateDialog({
  templates,
  onClose,
  onSelect,
}: DialogProps & {
  templates: DocumentMakerTemplate[];
  onSelect: (template: DocumentMakerTemplate) => void;
}) {
  return (
    <DialogFrame
      labelledBy="document-templates-title"
      panelClassName="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-surface p-5 shadow-2xl"
      onBackdropDismiss={onClose}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 id="document-templates-title" className="text-lg font-bold text-ink-primary">Start from a template</h2>
        <button type="button" aria-label="Close templates" onClick={onClose}><X className="h-5 w-5 text-ink-muted" /></button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template)}
            className="rounded-xl border border-ui p-4 text-left transition hover:border-action-border hover:bg-action-subtle"
          >
            <span className="block text-sm font-bold text-ink-primary">{template.title}</span>
            <span className="mt-1 block text-xs leading-5 text-ink-muted">{template.description}</span>
          </button>
        ))}
      </div>
    </DialogFrame>
  );
}

export function DocumentFindReplaceDialog({
  onClose,
  onFindNext,
  onReplace,
  onReplaceAll,
}: DialogProps & {
  onFindNext: (search: string) => void;
  onReplace: (search: string, replacement: string) => void;
  onReplaceAll: (search: string, replacement: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [replacement, setReplacement] = useState("");

  return (
    <DialogFrame
      labelledBy="document-find-title"
      panelClassName="w-full max-w-md rounded-2xl bg-surface p-5 shadow-2xl"
      onBackdropDismiss={onClose}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 id="document-find-title" className="text-lg font-bold text-ink-primary">Find and replace</h2>
        <button type="button" aria-label="Close find and replace" onClick={onClose}><X className="h-5 w-5 text-ink-muted" /></button>
      </div>
      <label className="block text-xs font-semibold text-ink-secondary">
        Find
        <InputField autoFocus value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 w-full rounded-lg border border-ui px-3 py-2 text-sm" />
      </label>
      <label className="mt-3 block text-xs font-semibold text-ink-secondary">
        Replace with
        <InputField value={replacement} onChange={(event) => setReplacement(event.target.value)} className="mt-1 w-full rounded-lg border border-ui px-3 py-2 text-sm" />
      </label>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" disabled={!search.trim()} onClick={() => onFindNext(search)} className="rounded-lg border border-ui px-3 py-2 text-xs font-semibold text-ink-secondary disabled:opacity-40">Find next</button>
        <button type="button" disabled={!search.trim()} onClick={() => onReplace(search, replacement)} className="rounded-lg border border-ui px-3 py-2 text-xs font-semibold text-ink-secondary disabled:opacity-40">Replace</button>
        <button type="button" disabled={!search.trim()} onClick={() => onReplaceAll(search, replacement)} className="rounded-lg bg-action px-3 py-2 text-xs font-semibold text-ink-inverse disabled:opacity-40">Replace all</button>
      </div>
    </DialogFrame>
  );
}

export function DocumentExportDialog({
  html,
  pageCount,
  fileName,
  isExporting,
  onFileNameChange,
  onDownloadPdf,
  onDownloadDocx,
  onClose,
}: DialogProps & {
  html: string;
  pageCount: number;
  fileName: string;
  isExporting: boolean;
  onFileNameChange: (value: string) => void;
  onDownloadPdf: () => void;
  onDownloadDocx: () => void;
}) {
  const previewRef = useRef<HTMLIFrameElement>(null);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    const frame = previewRef.current;
    if (!frame) return;

    const fitPages = () => {
      const document = frame.contentDocument;
      if (!document) return;
      const pages = Array.from(
        document.querySelectorAll<HTMLElement>(".document-maker-preview-page"),
      );
      const shells = Array.from(
        document.querySelectorAll<HTMLElement>(".document-maker-preview-page-shell"),
      );
      const activePage = pages[currentPage];
      if (!activePage || shells.length !== pages.length) return;

      shells.forEach((shell, index) => {
        shell.style.display = index === currentPage ? "flex" : "none";
      });

      const pageWidth = activePage.offsetWidth;
      const pageHeight = activePage.offsetHeight;
      const scale = Math.min(
        1,
        Math.max(0.1, (frame.clientWidth - 48) / pageWidth),
      );

      const activeShell = shells[currentPage];
      if (!activeShell) return;
      activeShell.style.width = `${pageWidth * scale}px`;
      activeShell.style.height = `${pageHeight * scale}px`;
      activePage.style.transform = `scale(${scale}) translateX(-50%)`;
    };

    frame.addEventListener("load", fitPages);
    const resizeObserver = new ResizeObserver(fitPages);
    resizeObserver.observe(frame);
    window.addEventListener("resize", fitPages);
    fitPages();

    return () => {
      frame.removeEventListener("load", fitPages);
      resizeObserver.disconnect();
      window.removeEventListener("resize", fitPages);
    };
  }, [currentPage, html]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  return (
    <DialogFrame
      labelledBy="document-export-title"
      panelClassName="flex h-[84vh] max-h-[800px] w-[84vw] max-w-5xl flex-col overflow-hidden rounded-3xl border border-ui bg-surface p-0 shadow-2xl"
      onBackdropDismiss={onClose}
    >
      <div className="flex min-h-16 items-center justify-between gap-3 border-b border-ui px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-action-subtle text-action">
            <Eye className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="document-export-title" className="truncate text-base font-bold text-ink-primary">
              Preview and export
            </h2>
            <p className="text-xs text-ink-muted">
              Page {currentPage + 1} of {pageCount}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="Previous preview page"
            disabled={currentPage === 0}
            onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-ui text-ink-secondary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="hidden min-w-16 text-center text-xs font-semibold tabular-nums text-ink-secondary sm:block" aria-live="polite">
            {currentPage + 1} / {pageCount}
          </span>
          <button
            type="button"
            aria-label="Next preview page"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setCurrentPage((page) => Math.min(pageCount - 1, page + 1))}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-ui text-ink-secondary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          aria-label="Close export preview"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-action"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="document-maker-preview-stage flex min-h-0 flex-1 flex-col p-2 sm:p-3">
        <iframe
          ref={previewRef}
          title="Full page print preview"
          className="document-maker-preview-frame min-h-0 w-full flex-1 rounded-2xl border border-ui"
          sandbox="allow-same-origin"
          srcDoc={html}
        />
      </div>
      <div className="flex flex-col gap-3 border-t border-ui bg-surface px-4 py-3 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <label className="min-w-48 flex-1 text-xs font-semibold text-ink-secondary">
          File name
          <InputField
            value={fileName}
            onChange={(event) => onFileNameChange(event.target.value)}
            className="mt-1 w-full rounded-xl border border-ui bg-surface-muted px-3 py-2 text-sm text-ink-primary focus:border-action-outline focus:bg-surface"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isExporting}
            onClick={onDownloadDocx}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-ui px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-muted disabled:opacity-50"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />Word
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={onDownloadPdf}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-action px-5 py-2 text-sm font-semibold text-ink-inverse shadow-sm transition-colors hover:bg-action-hover disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {isExporting ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </div>
    </DialogFrame>
  );
}
