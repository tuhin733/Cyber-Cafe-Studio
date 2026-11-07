import { Download, Loader2 } from "lucide-react";

interface Props {
  version: string;
  downloadState: "idle" | "downloading" | "installing" | "error";
  progress: number;
  installerUrl?: string;
  onUpdate: () => void;
  onManualDownload: () => void;
  onLater: () => void;
}

export default function UpdateDialog({
  version,
  downloadState,
  progress,
  installerUrl,
  onUpdate,
  onManualDownload,
  onLater,
}: Props) {
  const isBusy =
    downloadState === "downloading" || downloadState === "installing";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/45 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-title"
        aria-describedby="update-description"
        className="w-full max-w-sm rounded-2xl bg-surface p-6 text-center shadow-2xl ring-1 ring-ink-primary/10"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-action-subtle text-action">
          <Download className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2
          id="update-title"
          className="mt-4 text-lg font-bold tracking-tight text-ink-primary"
        >
          Update available
        </h2>
        <p
          id="update-description"
          className="mt-2 text-sm text-ink-secondary"
        >
          Cyber Cafe Studio {version} is ready to download.
        </p>
        {downloadState === "downloading" && (
          <div className="mt-5">
            <div
              role="progressbar"
              aria-label="Downloading update"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
              className="h-2 overflow-hidden rounded-full bg-ui-subtle"
            >
              <div
                className="h-full rounded-full bg-action transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-ink-secondary">
              Downloading update... {Math.round(progress)}%
            </p>
          </div>
        )}
        {downloadState === "installing" && (
          <p className="mt-4 text-sm text-action" role="status">
            Installing update and restarting Cyber Cafe Studio...
          </p>
        )}
        {downloadState === "error" && (
          <p className="mt-4 text-sm text-danger" role="alert">
            Automatic update couldn't complete. Retry or use the manual
            installer below.
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={onLater}
            disabled={isBusy}
            className="rounded-lg border border-ui px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-muted"
          >
            Later
          </button>
          <button
            type="button"
            onClick={onUpdate}
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2 text-sm font-semibold text-ink-inverse transition-colors hover:bg-action-hover disabled:cursor-wait disabled:opacity-70"
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            {downloadState === "downloading"
              ? "Downloading"
              : downloadState === "installing"
                ? "Installing"
                : downloadState === "error"
                  ? "Retry update"
                  : "Update"}
          </button>
        </div>
        {installerUrl && (
          <button
            type="button"
            onClick={onManualDownload}
            disabled={isBusy}
            className="mt-4 text-sm font-semibold text-action underline underline-offset-2 hover:text-action-hover"
          >
            Download installer manually
          </button>
        )}
      </section>
    </div>
  );
}
