import { useEffect, useState } from "react";
import { FileDown, X } from "lucide-react";
import type { LayoutSettings, UploadedDoc } from "../types";
import { generatePDF, PDF_COMPRESSION_OPTIONS, type PdfCompression } from "../lib/pdf";
import { notifyUserError } from "../lib/userErrors";
import DialogFrame from "./DialogFrame";

interface Props {
  docs: UploadedDoc[];
  settings: LayoutSettings;
  blankPageCount: number;
  onExport: (pdf: Blob) => void;
  onCancel: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function SizeEstimate({
  sourceSize,
  estimatedPdf,
  estimating,
}: {
  sourceSize: number;
  estimatedPdf: Blob | null;
  estimating: boolean;
}) {
  return (
    <span className="mt-3 grid grid-cols-2 gap-2">
      <span className="min-w-0 rounded-lg border border-ui bg-surface/80 px-2.5 py-2">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-ink-muted">
          Actual Size
        </span>
        <strong className="mt-0.5 block text-xs font-semibold text-ink-strong">
          {formatBytes(sourceSize)}
        </strong>
      </span>
      <span className="min-w-0 rounded-lg border border-action-border bg-action-subtle/70 px-2.5 py-2">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-action">
          Estimated Size
        </span>
        <span className="mt-0.5 block text-xs font-semibold text-action-hover">
          {estimating
            ? <strong className="block">Calculating...</strong>
            : estimatedPdf
              ? <strong className="block">{formatBytes(estimatedPdf.size)}</strong>
              : <strong className="block">Unavailable</strong>}
        </span>
      </span>
    </span>
  );
}

export default function PdfExportDialog({
  docs,
  settings,
  blankPageCount,
  onExport,
  onCancel,
}: Props) {
  const [compression, setCompression] = useState<PdfCompression>("recommended");
  const [estimatedPdf, setEstimatedPdf] = useState<Blob | null>(null);
  const [estimating, setEstimating] = useState(true);
  const sourceSize = docs.reduce((total, doc) => total + doc.file.size, 0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  useEffect(() => {
    let active = true;
    setEstimatedPdf(null);
    setEstimating(true);
    const timeout = window.setTimeout(() => {
      void generatePDF(
        docs,
        settings,
        compression,
        blankPageCount,
      )
        .then((pdf) => {
          if (active) setEstimatedPdf(pdf);
        })
        .catch((error: unknown) => {
          console.error("Could not estimate PDF size", error);
          if (active) {
            notifyUserError(
              "Couldn't prepare the PDF estimate. Check the images and try again.",
            );
          }
        })
        .finally(() => {
          if (active) setEstimating(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [blankPageCount, compression, docs, settings]);

  const selectCompression = (value: PdfCompression) => {
    setEstimatedPdf(null);
    setCompression(value);
  };

  return (
    <DialogFrame
      labelledBy="pdf-export-title"
      panelClassName="w-full max-w-md rounded-2xl bg-surface p-5 shadow-2xl"
      onBackdropDismiss={onCancel}
      backdropDismissOn="mouseDown"
    >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-action-subtle text-action">
              <FileDown className="h-5 w-5" />
            </span>
            <div>
              <h2 id="pdf-export-title" className="text-base font-bold text-ink-primary">
                Export PDF
              </h2>
              <p className="text-xs text-ink-muted">
                Choose the image quality and file size.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close PDF options"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-subtle hover:text-ink-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <fieldset className="space-y-2">
          <legend className="sr-only">PDF compression level</legend>
          {PDF_COMPRESSION_OPTIONS.map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                compression === option.id
                  ? "border-action-outline bg-action-subtle/70"
                  : "border-ui hover:bg-surface-muted"
              }`}
            >
              <input
                type="radio"
                name="pdf-compression"
                value={option.id}
                checked={compression === option.id}
                onChange={() => selectCompression(option.id)}
                className="mt-0.5 accent-action-emphasis"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-ink-primary">
                  {option.label}
                  {option.id === "recommended" && (
                    <span className="rounded-full bg-action-soft px-2 py-0.5 text-[10px] font-bold text-action">
                      Recommended
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-ink-muted">
                  {option.description}
                </span>
                {compression === option.id && (
                  <SizeEstimate
                    sourceSize={sourceSize}
                    estimatedPdf={estimatedPdf}
                    estimating={estimating}
                  />
                )}
              </span>
            </label>
          ))}
        </fieldset>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-ui px-4 py-2 text-sm font-semibold text-ink-secondary hover:bg-surface-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (estimatedPdf) onExport(estimatedPdf);
            }}
            disabled={!estimatedPdf || estimating}
            className="flex items-center gap-2 rounded-lg bg-action-emphasis px-4 py-2 text-sm font-semibold text-ink-inverse hover:bg-action disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" />
            Export PDF
          </button>
        </div>
    </DialogFrame>
  );
}
