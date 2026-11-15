import { useCallback, useEffect, useState } from "react";
import { Loader2, Printer, RefreshCw, X } from "lucide-react";
import {
  getPrintPageNumbers,
  type PrintPageMode,
} from "../lib/documentPrint";
import { notifyUserError } from "../lib/userErrors";
import { notifyUserSuccess } from "../lib/userNotifications";
import DialogFrame from "./DialogFrame";
import Dropdown from "./Dropdown";
import InputField from "./InputField";

interface PrinterOption {
  name: string;
  displayName: string;
}

interface Props {
  pageCount: number;
  onPrint: (
    printerName: string,
    copies: number,
    pageNumbers: number[],
  ) => Promise<void>;
  onClose: () => void;
}

export default function DocumentPrintDialog({
  pageCount,
  onPrint,
  onClose,
}: Props) {
  const [printers, setPrinters] = useState<PrinterOption[]>([]);
  const [printerName, setPrinterName] = useState("");
  const [copies, setCopies] = useState(1);
  const [pageMode, setPageMode] = useState<PrintPageMode>("all");
  const [customPages, setCustomPages] = useState("");
  const [loadingPrinters, setLoadingPrinters] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [printSent, setPrintSent] = useState(false);
  const [error, setError] = useState("");
  const selectedPageNumbers = getPrintPageNumbers(
    pageMode,
    pageCount,
    customPages,
  );
  const hasValidPageSelection = selectedPageNumbers.length > 0;

  const loadPrinters = useCallback(async () => {
    if (!window.desktopAPI) {
      setLoadingPrinters(false);
      setError("Direct printing is only available in the Windows desktop app.");
      return;
    }

    setLoadingPrinters(true);
    setError("");
    try {
      const availablePrinters = await window.desktopAPI.getPrinters();
      setPrinters(availablePrinters);
      setPrinterName((current) =>
        availablePrinters.some((printer) => printer.name === current)
          ? current
          : availablePrinters[0]?.name ?? "",
      );
      if (availablePrinters.length === 0) {
        setError("No printers were found. Connect a printer and try again.");
      }
    } catch (loadError) {
      console.error("Unable to load printers for document printing", loadError);
      setError("Couldn't load printers. Check the Windows print spooler and try again.");
    } finally {
      setLoadingPrinters(false);
    }
  }, []);

  useEffect(() => {
    void loadPrinters();
  }, [loadPrinters]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !printing) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, printing]);

  const handlePrint = async () => {
    if (!printerName || printing || printSent) return;
    setPrinting(true);
    setError("");
    try {
      await onPrint(printerName, copies, selectedPageNumbers);
      setPrintSent(true);
      notifyUserSuccess(
        `Print job sent to ${printers.find((printer) => printer.name === printerName)?.displayName ?? "the printer"}.`,
      );
    } catch (printError) {
      console.error("Unable to print document pages", printError);
      const message =
        printError instanceof Error
          ? printError.message
          : "The document could not be printed. Check the printer and try again.";
      setError(message);
      notifyUserError(message);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <DialogFrame
      labelledBy="document-print-title"
      panelClassName="w-full max-w-md rounded-2xl bg-surface p-5 shadow-2xl"
      onBackdropDismiss={() => {
        if (!printing) onClose();
      }}
      backdropDismissOn="mouseDown"
    >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-action-subtle text-action">
              <Printer className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="document-print-title" className="text-base font-bold text-ink-primary">
                Printer settings
              </h2>
              <p className="text-xs text-ink-muted">
                {selectedPageNumbers.length} of {pageCount}{" "}
                {pageCount === 1 ? "page" : "pages"} · A4 portrait · Black &amp; white
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close print options"
            onClick={onClose}
            disabled={printing}
            className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-subtle hover:text-ink-secondary disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <section className="border-t border-ui-subtle pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              Printer settings
            </h3>
            <button
              type="button"
              onClick={() => void loadPrinters()}
              disabled={loadingPrinters || printing}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-action hover:text-action-hover disabled:opacity-50"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Refresh
            </button>
          </div>

          <div className="space-y-3">
          <div>
            <label
              htmlFor="document-print-printer"
              className="block text-[11px] font-medium text-ink-muted"
            >
              Installed printer
            </label>
            <Dropdown
              id="document-print-printer"
              value={printerName}
              onChange={setPrinterName}
              disabled={loadingPrinters || printing || printers.length === 0}
              className="mt-1 w-full rounded-lg border border-ui bg-surface px-3 py-2.5 text-sm font-medium text-ink-strong outline-none focus:border-action-accent focus:ring-2 focus:ring-action-soft disabled:bg-surface-muted"
              options={printers.length === 0
                ? [{ value: "", label: "No printers available" }]
                : printers.map((printer) => ({ value: printer.name, label: printer.displayName }))}
            />
          </div>

          <label className="block text-[11px] font-medium text-ink-muted">
            Copies of each sheet
            <InputField
              type="number"
              min={1}
              max={99}
              step={1}
              value={copies}
              onChange={(event) => {
                const nextCopies = Number(event.target.value);
                if (Number.isInteger(nextCopies) && nextCopies >= 1 && nextCopies <= 99) {
                  setCopies(nextCopies);
                }
              }}
              disabled={printing}
              className="mt-1 w-full rounded-lg border border-ui px-3 py-2.5 text-sm font-semibold text-ink-strong outline-none focus:border-action-accent focus:ring-2 focus:ring-action-soft"
            />
          </label>

          <label className="block text-[11px] font-medium text-ink-muted">
            Pages
            <Dropdown
              value={pageMode}
              onChange={(value) => setPageMode(value as PrintPageMode)}
              disabled={printing}
              className="mt-1 w-full rounded-lg border border-ui bg-surface px-3 py-2.5 text-sm font-medium text-ink-strong outline-none focus:border-action-accent focus:ring-2 focus:ring-action-soft"
              options={[
                { value: "all", label: "All pages" },
                { value: "odd", label: "Odd pages only" },
                { value: "even", label: "Even pages only" },
                { value: "custom", label: "Custom pages" },
              ]}
            />
          </label>

          {pageMode === "custom" && (
            <label className="block text-[11px] font-medium text-ink-muted">
              Custom page numbers
              <InputField
                type="text"
                value={customPages}
                onChange={(event) => setCustomPages(event.target.value)}
                placeholder="e.g. 1, 3-5"
                disabled={printing}
                aria-invalid={!hasValidPageSelection}
                aria-describedby="document-print-pages-help"
                className="mt-1 w-full rounded-lg border border-ui px-3 py-2.5 text-sm font-semibold text-ink-strong outline-none focus:border-action-accent focus:ring-2 focus:ring-action-soft"
              />
              <span
                id="document-print-pages-help"
                className={`mt-1 block font-normal ${
                  hasValidPageSelection ? "text-ink-faint" : "text-danger-strong"
                }`}
              >
                {hasValidPageSelection
                  ? `Printing ${selectedPageNumbers.length} page${selectedPageNumbers.length === 1 ? "" : "s"}`
                  : `Enter pages from 1 to ${pageCount}, separated by commas or ranges.`}
              </span>
            </label>
          )}

          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-ink-faint">
            Prints directly without a Windows dialog. Original document colors are
            unchanged; the printer is asked for black-and-white output.
          </p>

          {error && (
            <p className="text-xs leading-5 text-danger" role="alert">
              {error}
            </p>
          )}

        </section>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={printing}
            className="rounded-lg border border-ui px-4 py-2 text-sm font-semibold text-ink-secondary hover:bg-surface-muted disabled:opacity-50"
          >
            {printSent ? "Done" : "Cancel"}
          </button>
          {!printSent && (
            <button
              type="button"
              onClick={() => void handlePrint()}
              disabled={
                loadingPrinters ||
                printing ||
                !printerName ||
                !hasValidPageSelection
              }
              className="flex items-center gap-2 rounded-lg bg-action-emphasis px-4 py-2 text-sm font-semibold text-ink-inverse hover:bg-action disabled:cursor-not-allowed disabled:opacity-50"
            >
              {printing || loadingPrinters ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Printer className="h-4 w-4" aria-hidden="true" />
              )}
              {loadingPrinters ? "Loading printers…" : printing ? "Sending…" : "Print"}
            </button>
          )}
        </div>
    </DialogFrame>
  );
}
