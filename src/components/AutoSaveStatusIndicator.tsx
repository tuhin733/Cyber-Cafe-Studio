import {
  CircleAlert,
  CheckCircle2,
  Clock,
  CloudDownload,
  LoaderCircle,
  RefreshCw,
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
      data-tooltip={
        status === "saved" && lastSavedAt !== null
          ? `Last saved ${new Date(lastSavedAt).toLocaleTimeString()}`
          : undefined
      }
      className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium leading-none ${
        status === "error"
          ? "text-danger"
          : status === "saved"
            ? "text-success"
            : status === "saving"
              ? "text-warning"
              : "text-ink-muted"
      }`}
    >
      {status === "loading" ? (
        <CloudDownload className="h-3.5 w-3.5" aria-hidden="true" />
      ) : status === "pending" ? (
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      ) : status === "saving" ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : status === "saved" ? (
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      ) : status === "error" ? (
        <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
      ) : null}
      {status === "loading"
        ? "Restoring saved work…"
        : status === "pending"
          ? "Unsaved changes"
        : status === "saving"
          ? "Saving…"
          : status === "error"
            ? "Save failed"
            : lastSavedAt === null
              ? "All changes saved"
              : `Saved ${savedAgo}`}
      {status === "error" && (
        <button
          type="button"
          onClick={onRetry}
          aria-label="Retry autosave"
          data-tooltip="Retry autosave"
          className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-semibold text-danger/80 transition-colors hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Retry
        </button>
      )}
    </span>
  );
}
