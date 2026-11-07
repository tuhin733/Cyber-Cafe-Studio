import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Trash2,
  GripVertical,
  Copy,
  Pencil,
  MoreVertical,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { UploadedDoc } from "../types";
import { DOC_CATEGORIES } from "../constants";
import InputField from "./InputField";

interface Props {
  docs: UploadedDoc[];
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onReorder: (id: string, dir: -1 | 1) => void;
  onLabelChange: (id: string, label: string) => void;
  onDocumentSizeChange: (
    id: string,
    patch: Pick<UploadedDoc, "fitToPage" | "widthMm" | "heightMm">,
  ) => void;
  onEdit: (id: string) => void;
}

export default function DocTray({
  docs,
  onRemove,
  onDuplicate,
  onReorder,
  onLabelChange,
  onDocumentSizeChange,
  onEdit,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollEdges, setScrollEdges] = useState({ top: false, bottom: false });

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const updateScrollEdges = () => {
      const maxScrollTop = list.scrollHeight - list.clientHeight;
      setScrollEdges({
        top: list.scrollTop > 1,
        bottom: maxScrollTop - list.scrollTop > 1,
      });
    };

    updateScrollEdges();
    const resizeObserver = new ResizeObserver(updateScrollEdges);
    resizeObserver.observe(list);
    Array.from(list.children).forEach((child) => resizeObserver.observe(child));
    window.addEventListener("resize", updateScrollEdges);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateScrollEdges);
    };
  }, [docs]);

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ui py-6 text-center">
        <p className="text-sm font-medium text-ink-faint">No documents yet</p>
        <p className="mt-1 text-xs text-ink-disabled">
          Upload card images to get started
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={listRef}
        role="region"
        aria-label="Uploaded documents"
        tabIndex={0}
        onScroll={(event) => {
          const list = event.currentTarget;
          const maxScrollTop = list.scrollHeight - list.clientHeight;
          setScrollEdges({
            top: list.scrollTop > 1,
            bottom: maxScrollTop - list.scrollTop > 1,
          });
        }}
        className="h-full min-h-0 space-y-2 overflow-y-auto overscroll-contain pr-1 scrollbar-hidden scroll-smooth focus-visible:outline focus-visible:outline-2 focus-visible:outline-action-accent"
      >
        {docs.map((doc, idx) => {
          const cat = DOC_CATEGORIES[doc.category];
          return (
            <div
              key={doc.id}
              className="group rounded-xl border border-ui bg-surface transition-all hover:border-ui-strong hover:shadow-sm"
            >
            <div className="flex items-center gap-2 p-2.5">
              {/* Index */}
              <div className="flex flex-col items-center">
                <GripVertical className="h-4 w-4 text-ink-disabled" />
                <span className="text-[10px] font-bold text-ink-faint">
                  {idx + 1}
                </span>
              </div>

              {/* Thumbnail */}
              <div
                className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md border border-ui bg-surface-muted"
                style={{
                  borderColor: `color-mix(in srgb, ${cat.accent} 25%, transparent)`,
                }}
              >
                <img
                  src={doc.url}
                  alt={doc.label}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Label */}
              <div className="min-w-0 flex-1">
                <InputField
                  type="text"
                  value={doc.label}
                  onChange={(e) => onLabelChange(doc.id, e.target.value)}
                  className="w-full truncate rounded border border-transparent px-1.5 py-0.5 text-sm font-medium text-ink-strong hover:border-ui focus:border-action-outline focus:outline-none"
                />
                <p className="px-1.5 text-[10px] text-ink-faint">
                  {cat.label} · {doc.pxW}×{doc.pxH}px
                </p>
              </div>

              {/* Kebab menu */}
              <div className="flex items-center gap-0.5">
                <KebabMenu
                  doc={doc}
                  idx={idx}
                  total={docs.length}
                  onEdit={onEdit}
                  onRemove={onRemove}
                  onDuplicate={onDuplicate}
                  onReorder={onReorder}
                />
              </div>
            </div>
            {doc.category === "document" && (
              <div className="space-y-3 border-t border-ui-subtle px-3 py-3">
                <label className="flex items-center gap-2 text-xs font-medium text-ink-secondary">
                  <input
                    type="checkbox"
                    checked={doc.fitToPage}
                    onChange={(event) =>
                      onDocumentSizeChange(doc.id, {
                        fitToPage: event.target.checked,
                        widthMm: doc.widthMm,
                        heightMm: doc.heightMm,
                      })
                    }
                    className="h-4 w-4 rounded border-ui-strong accent-action-emphasis"
                  />
                  Fit to page
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] font-medium text-ink-muted">
                    Width (mm)
                    <InputField
                      type="number"
                      min={1}
                      max={190}
                      step={1}
                      value={doc.widthMm}
                      disabled={doc.fitToPage}
                      onChange={(event) => {
                        const widthMm = Number(event.target.value);
                        if (Number.isFinite(widthMm) && widthMm >= 1 && widthMm <= 190) {
                          onDocumentSizeChange(doc.id, {
                            fitToPage: false,
                            widthMm,
                            heightMm: doc.heightMm,
                          });
                        }
                      }}
                      className="mt-1 w-full rounded-md border border-ui px-2 py-1.5 text-xs text-ink-strong disabled:bg-surface-muted disabled:text-ink-faint"
                    />
                  </label>
                  <label className="text-[11px] font-medium text-ink-muted">
                    Height (mm)
                    <InputField
                      type="number"
                      min={1}
                      max={277}
                      step={1}
                      value={doc.heightMm}
                      disabled={doc.fitToPage}
                      onChange={(event) => {
                        const heightMm = Number(event.target.value);
                        if (Number.isFinite(heightMm) && heightMm >= 1 && heightMm <= 277) {
                          onDocumentSizeChange(doc.id, {
                            fitToPage: false,
                            widthMm: doc.widthMm,
                            heightMm,
                          });
                        }
                      }}
                      className="mt-1 w-full rounded-md border border-ui px-2 py-1.5 text-xs text-ink-strong disabled:bg-surface-muted disabled:text-ink-faint"
                    />
                  </label>
                </div>
                <p className="text-[10px] text-ink-faint">
                  Custom dimensions are limited to the printable page area.
                </p>
              </div>
            )}
            </div>
          );
        })}
      </div>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-5 rounded-t-xl bg-gradient-to-b from-surface-muted/95 to-transparent transition-opacity ${
          scrollEdges.top ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-7 rounded-b-xl bg-gradient-to-t from-surface-subtle/90 to-transparent transition-opacity ${
          scrollEdges.bottom ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}

function KebabMenu({
  doc,
  idx,
  total,
  onEdit,
  onRemove,
  onDuplicate,
  onReorder,
}: {
  doc: UploadedDoc;
  idx: number;
  total: number;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onReorder: (id: string, dir: -1 | 1) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstMenuItemRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    firstMenuItemRef.current?.focus();
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const positionMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const menuWidth = 176;
    const menuHeight = 172;
    const gap = 4;
    const left = Math.max(
      8,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8),
    );
    const top =
      rect.bottom + menuHeight + gap <= window.innerHeight
        ? rect.bottom + gap
        : Math.max(8, rect.top - menuHeight - gap);

    setMenuPosition({ top, left });
  };

  const close = () => setOpen(false);

  const items: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    danger?: boolean;
    disabled?: boolean;
  }[] = [
    {
      icon: <Pencil className="h-3.5 w-3.5" />,
      label: "Edit image",
      onClick: () => { onEdit(doc.id); close(); },
    },
    {
      icon: <Copy className="h-3.5 w-3.5" />,
      label: "Duplicate",
      onClick: () => { onDuplicate(doc.id); close(); },
    },
    {
      icon: <ArrowUp className="h-3.5 w-3.5" />,
      label: "Move up",
      onClick: () => { onReorder(doc.id, -1); close(); },
      disabled: idx === 0,
    },
    {
      icon: <ArrowDown className="h-3.5 w-3.5" />,
      label: "Move down",
      onClick: () => { onReorder(doc.id, 1); close(); },
      disabled: idx === total - 1,
    },
    {
      icon: <Trash2 className="h-3.5 w-3.5" />,
      label: "Delete",
      onClick: () => { onRemove(doc.id); close(); },
      danger: true,
    },
  ];

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        title="More actions"
        aria-label={`More actions for ${doc.label}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          if (!open) positionMenu();
          setOpen(!open);
        }}
        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-surface-subtle hover:text-ink-strong"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          style={{ top: menuPosition.top, left: menuPosition.left }}
          role="menu"
          aria-label={`Actions for ${doc.label}`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
              buttonRef.current?.focus();
            }
          }}
          className="fixed z-[100] w-44 overflow-hidden rounded-lg border border-ui bg-surface py-1 shadow-xl"
        >
          {items.map((item, i) => (
            <button
              key={i}
              ref={i === 0 ? firstMenuItemRef : undefined}
              role="menuitem"
              onClick={(e) => { e.stopPropagation(); if (!item.disabled) item.onClick(); }}
              disabled={item.disabled}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium transition-colors ${
                item.disabled
                  ? "cursor-not-allowed text-ink-disabled"
                  : item.danger
                    ? "text-error-outline hover:bg-error-subtle"
                    : "text-ink-secondary hover:bg-surface-muted"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
