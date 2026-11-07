import type { LayoutSettings } from "../types";
import {
  Sliders,
  Grid2x2,
  LayoutGrid,
  Square,
  FileDown,
  Loader2,
  Plus,
  Minus,
  Move,
  RotateCcw,
  FileText,
  Printer,
} from "lucide-react";
import AutoSaveStatusIndicator from "./AutoSaveStatusIndicator";
import type { AutoSaveStatus } from "../lib/autoSaveStatus";

interface Props {
  settings: LayoutSettings;
  onChange: (patch: Partial<LayoutSettings>) => void;
  documentMode: boolean;
  onExport: () => void;
  busy: boolean;
  cardCount: number;
  pageCount: number;
  arrangeMode: boolean;
  onArrangeModeChange: (enabled: boolean) => void;
  onResetPlacements: () => void;
  autoSaveStatus: AutoSaveStatus;
  autoSaveLastSavedAt: number | null;
  onRetryAutoSave: () => void;
  onPrint?: () => void;
}

export default function ControlPanel({
  settings,
  onChange,
  documentMode,
  onExport,
  busy,
  cardCount,
  pageCount,
  arrangeMode,
  onArrangeModeChange,
  onResetPlacements,
  autoSaveStatus,
  autoSaveLastSavedAt,
  onRetryAutoSave,
  onPrint,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex justify-center border-b border-ui-subtle pb-3">
        <AutoSaveStatusIndicator
          status={autoSaveStatus}
          lastSavedAt={autoSaveLastSavedAt}
          onRetry={onRetryAutoSave}
        />
      </div>

      {/* Layout section */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Sliders className="h-4 w-4 shrink-0 text-action-emphasis" />
            <h3 className="truncate text-sm font-bold text-ink-strong">
              Control Panel
            </h3>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-[10px] font-semibold text-ink-secondary">
            <FileText className="h-3.5 w-3.5 text-ink-muted" />
            <span className="tabular-nums">{pageCount}</span>
            <span>{pageCount === 1 ? "page" : "pages"}</span>
          </span>
        </div>

        <div className="mb-3 flex gap-2">
          <button
            type="button"
            aria-pressed={arrangeMode}
            onClick={() => onArrangeModeChange(!arrangeMode)}
            className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
              arrangeMode
                ? "border-action-outline bg-action-subtle text-action"
                : "border-ui text-ink-secondary hover:bg-surface-subtle"
            }`}
          >
            <Move className="h-3.5 w-3.5" />
            {arrangeMode ? "Done arranging" : "Arrange images"}
          </button>
          {arrangeMode && (
            <button
              type="button"
              onClick={onResetPlacements}
              className="flex min-h-9 items-center gap-1.5 rounded-lg border border-ui px-2.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-subtle"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
        </div>

        {!documentMode && (
          <>
            {/* Grid mode buttons */}
            <div className="mb-3 grid grid-cols-3 gap-2">
              <GridBtn
                active={settings.cols === 0}
                onClick={() => onChange({ cols: 0, rows: 0 })}
                icon={<LayoutGrid className="h-4 w-4" />}
                label="Auto"
              />
              <GridBtn
                active={settings.cols === 2}
                onClick={() =>
                  onChange({
                    cols: 2,
                    cardW: Math.min(settings.cardW, (190 - settings.gap) / 2),
                  })
                }
                icon={<Grid2x2 className="h-4 w-4" />}
                label="2 cols"
              />
              <GridBtn
                active={settings.cols === 1}
                onClick={() => onChange({ cols: 1 })}
                icon={<Square className="h-4 w-4" />}
                label="1 col"
              />
            </div>

            {/* Card width slider */}
            <SliderRow
              label="Card width"
              value={settings.cardW}
              unit="mm"
              min={40}
              max={Math.min(
                180,
                (190 - Math.max(0, settings.cols - 1) * settings.gap) /
                  Math.max(settings.cols, 1),
              )}
              step={1}
              onChange={(v) => onChange({ cardW: v })}
            />
          </>
        )}

        {!documentMode && (
          <SliderRow
            label="Card spacing"
            value={settings.gap}
            unit="mm"
            min={0}
            max={15}
            step={0.5}
            onChange={(v) => onChange({ gap: v })}
          />
        )}

        <div className="mt-2">
          <p className="mb-1.5 text-xs font-medium text-ink-secondary">
            Vertical position
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(["top", "center"] as const).map((alignment) => (
              <button
                key={alignment}
                type="button"
                aria-pressed={settings.verticalAlign === alignment}
                onClick={() => onChange({ verticalAlign: alignment })}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                  settings.verticalAlign === alignment
                    ? "border-action-outline bg-action-subtle text-action"
                    : "border-ui bg-surface text-ink-muted hover:bg-surface-muted"
                }`}
              >
                {alignment}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px bg-surface-subtle" />

      {/* Summary */}
      <section className="rounded-xl bg-surface-muted p-2.5">
        <div className="grid grid-cols-2 gap-2 text-center">
          <Stat value={cardCount} label="Cards" />
          <Stat
            value={cardCount > 0 && pageCount > 0
              ? (cardCount / pageCount).toFixed(1)
              : "0"}
            label="Per page"
          />
        </div>
      </section>

      {/* Actions */}
      <section className={onPrint ? "grid grid-cols-2 gap-2" : "space-y-2.5"}>
        <button
          type="button"
          title="Export PDF (Ctrl+S)"
          onClick={onExport}
          disabled={busy || (cardCount === 0 && pageCount === 0)}
          className="flex min-w-0 w-full items-center justify-center gap-1.5 rounded-xl bg-preview-muted px-2 py-2.5 text-xs font-bold text-ink-inverse shadow-sm transition-all hover:bg-preview hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          <span className="truncate">Export PDF</span>
        </button>
        {onPrint && (
          <button
            type="button"
            title="Print in black and white without opening the Windows print dialog"
            onClick={onPrint}
            disabled={busy || cardCount === 0}
            className="flex min-w-0 w-full items-center justify-center gap-1.5 rounded-xl bg-action-emphasis px-2 py-2.5 text-xs font-bold text-ink-inverse shadow-sm transition-colors hover:bg-action disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Printer className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Print B&amp;W</span>
          </button>
        )}
      </section>
    </div>
  );
}

function GridBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 transition-all ${
        active
          ? "border-action-outline bg-action-subtle text-action shadow-sm"
          : "border-ui bg-surface text-ink-muted hover:border-ui-strong hover:bg-surface-muted"
      }`}
    >
      {icon}
      <span className="text-[11px] font-semibold">{label}</span>
    </button>
  );
}

function SliderRow({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-ink-secondary">{label}</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={`Decrease ${label.toLowerCase()}`}
            title={`Decrease ${label.toLowerCase()}`}
            onClick={() => onChange(Math.max(min, +(value - step).toFixed(1)))}
            className="flex h-5 w-5 items-center justify-center rounded text-ink-faint hover:bg-surface-subtle"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="min-w-[52px] text-center text-xs font-bold tabular-nums text-ink-strong">
            {value.toFixed(step < 1 ? 1 : 0)} {unit}
          </span>
          <button
            type="button"
            aria-label={`Increase ${label.toLowerCase()}`}
            title={`Increase ${label.toLowerCase()}`}
            onClick={() => onChange(Math.min(max, +(value + step).toFixed(1)))}
            className="flex h-5 w-5 items-center justify-center rounded text-ink-faint hover:bg-surface-subtle"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ui accent-action-emphasis"
      />
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <p className="text-lg font-bold text-ink-strong">{value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </p>
    </div>
  );
}
