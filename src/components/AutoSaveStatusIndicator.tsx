import {
  AlertTriangle,
  CheckCircle2,
  CloudDownload,
  LoaderCircle,
  RefreshCw,
  Save,
} from "lucide-react";
import { useEffect, useState } from "react";
import { formatSavedTime, type AutoSaveStatus } from "../lib/autoSaveStatus";

interface Props {
  status: AutoSaveStatus;
  lastSavedAt?: number | null;
  onRetry: () => void;
}

export default function AutoSaveStatusIndicator({
  status,
  lastSavedAt = null,
  onRetry,
}: Props) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (status !== "saved" || lastSavedAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [lastSavedAt, status]);

  const savedAgo =
    lastSavedAt === null ? "" : formatSavedTime(lastSavedAt, now);

  return (
    <span
      role="status"
      aria-live="polite"
      title={
        status === "saved" && lastSavedAt !== null
          ? `Last saved ${new Date(lastSavedAt).toLocaleTimeString()}`
          : undefined
      }
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none ${
        status === "error"
          ? "border-danger-border bg-danger-subtle text-danger"
          : status === "saved"
            ? "border-success-border bg-success-subtle text-success"
            : status === "pending"
              ? "border-warning-border bg-warning-subtle text-warning"
              : status === "saving"
                ? "border-action-border bg-action-subtle text-action"
                : "border-ui bg-surface-muted text-ink-secondary"
      }`}
    >
      {status === "loading" ? (
        <CloudDownload className="h-3.5 w-3.5" aria-hidden="true" />
      ) : status === "pending" ? (
        <Save className="h-3.5 w-3.5" aria-hidden="true" />
      ) : status === "saving" ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : status === "saved" ? (
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {status === "loading"
        ? "Restoring saved work…"
        : status === "pending"
          ? "Unsaved changes"
        : status === "saving"
          ? "Saving…"
          : status === "error"
            ? "Changes not saved"
            : lastSavedAt === null
              ? "All changes saved"
              : `Saved ${savedAgo}`}
      {status === "error" && (
        <button
          type="button"
          onClick={onRetry}
          aria-label="Retry autosave"
          title="Retry autosave"
          className="inline-flex items-center gap-1 rounded-full border border-current/20 px-1.5 py-0.5 font-semibold text-action transition-colors hover:bg-surface/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-emphasis"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Retry
        </button>
      )}
    </span>
  );
}
