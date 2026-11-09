import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Circle,
  Copy,
  ImagePlus,
  Layers,
  Minus,
  Plus,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";
import Konva from "konva";
import {
  Image as KonvaImage,
  Layer,
  Rect,
  RegularPolygon,
  Stage,
  Text as KonvaText,
  Transformer,
} from "react-konva";
import BackToToolsButton from "./BackToToolsButton";
import { notifyUserError } from "../lib/userErrors";

type ElementType = "text" | "rect" | "circle" | "triangle" | "image";

interface DesignElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  fill: string;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  bold?: boolean;
  src?: string;
}

interface DesignDocument {
  width: number;
  height: number;
  background: string;
  elements: DesignElement[];
}

const STORAGE_KEY = "cyber-cafe-studio:design-studio";
const COLOR_SWATCHES = ["#0f766e", "#0f172a", "#2563eb", "#e11d48", "#f59e0b", "#ffffff"];
const SIZES = [
  { label: "Square · 1080 × 1080", width: 1080, height: 1080 },
  { label: "Portrait · 1080 × 1350", width: 1080, height: 1350 },
  { label: "Story · 1080 × 1920", width: 1080, height: 1920 },
  { label: "Landscape · 1920 × 1080", width: 1920, height: 1080 },
];

function createDocument(): DesignDocument {
  return {
    width: 1080,
    height: 1080,
    background: "#ffffff",
    elements: [],
  };
}

function loadDocument(): DesignDocument {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return createDocument();
    const parsed: unknown = JSON.parse(saved);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "width" in parsed &&
      "height" in parsed &&
      "background" in parsed &&
      "elements" in parsed &&
      typeof parsed.width === "number" &&
      typeof parsed.height === "number" &&
      typeof parsed.background === "string" &&
      Array.isArray(parsed.elements)
    ) {
      return parsed as DesignDocument;
    }
    notifyUserError("The saved Design Studio project could not be read. A new design was started.");
  } catch {
    notifyUserError("The saved Design Studio project could not be loaded. A new design was started.");
  }
  return createDocument();
}

function UploadedImage({
  element,
  selected,
  onSelect,
  onDragEnd,
  onTransformEnd,
}: {
  element: DesignElement;
  selected: boolean;
  onSelect: () => void;
  onDragEnd: (node: Konva.Node) => void;
  onTransformEnd: (node: Konva.Node) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!element.src) return;
    const nextImage = new window.Image();
    nextImage.onload = () => setImage(nextImage);
    nextImage.onerror = () => notifyUserError("This image could not be loaded.");
    nextImage.src = element.src;
  }, [element.src]);

  if (!image) return null;
  return (
    <KonvaImage
      id={element.id}
      image={image}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      rotation={element.rotation ?? 0}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(event) => onDragEnd(event.target)}
      onTransformEnd={(event) => onTransformEnd(event.target)}
      shadowColor={selected ? "#0f766e" : undefined}
      shadowBlur={selected ? 12 : 0}
    />
  );
}

export default function DesignStudio({ onClose }: { onClose: () => void }) {
  const [design, setDesign] = useState<DesignDocument>(loadDocument);
  const [past, setPast] = useState<DesignDocument[]>([]);
  const [future, setFuture] = useState<DesignDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [workspaceSize, setWorkspaceSize] = useState({ width: 0, height: 0 });
  const [saved, setSaved] = useState(true);
  const stageAreaRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const selectedElement = design.elements.find((element) => element.id === selectedId);
  const fitScale = useMemo(() => {
    if (!workspaceSize.width || !workspaceSize.height) return 0.5;
    return Math.max(
      0.05,
      Math.min(
        (workspaceSize.width - 64) / design.width,
        (workspaceSize.height - 64) / design.height,
        1,
      ),
    );
  }, [design.height, design.width, workspaceSize]);
  const scale = fitScale * zoom;
  const stageWidth = Math.round(design.width * scale);
  const stageHeight = Math.round(design.height * scale);

  useEffect(() => {
    const container = stageAreaRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setWorkspaceSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(design));
      setSaved(true);
    } catch {
      setSaved(false);
      notifyUserError("Your design could not be saved in this browser.");
    }
  }, [design]);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;
    const selectedNode = selectedId ? stage.findOne(`#${selectedId}`) : null;
    transformer.nodes(selectedNode ? [selectedNode] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedId, design.elements]);

  const updateDesign = useCallback((next: DesignDocument, recordHistory = true) => {
    if (recordHistory) {
      setPast((items) => [...items.slice(-49), design]);
      setFuture([]);
    }
    setDesign(next);
  }, [design]);

  const updateElement = (id: string, changes: Partial<DesignElement>) => {
    const next = {
      ...design,
      elements: design.elements.map((element) =>
        element.id === id ? { ...element, ...changes } : element,
      ),
    };
    updateDesign(next);
  };

  const addElement = (type: ElementType) => {
    const element: DesignElement = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      x: Math.round(design.width * 0.3),
      y: Math.round(design.height * 0.3),
      width: type === "text" ? 460 : type === "rect" ? 300 : 240,
      height: type === "text" ? 100 : 240,
      fill: type === "text" ? "#0f172a" : "#14b8a6",
      ...(type === "text" ? { text: "Your text here", fontSize: 64, fontFamily: "Arial" } : {}),
    };
    updateDesign({ ...design, elements: [...design.elements, element] });
    setSelectedId(element.id);
  };

  const undo = () => {
    const previous = past[past.length - 1];
    if (!previous) return;
    setFuture((items) => [...items, design]);
    setPast((items) => items.slice(0, -1));
    setDesign(previous);
  };

  const redo = () => {
    const next = future[future.length - 1];
    if (!next) return;
    setPast((items) => [...items, design]);
    setFuture((items) => items.slice(0, -1));
    setDesign(next);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    updateDesign({
      ...design,
      elements: design.elements.filter((element) => element.id !== selectedId),
    });
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selectedElement) return;
    const duplicate = {
      ...selectedElement,
      id: `${selectedElement.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      x: selectedElement.x + 32,
      y: selectedElement.y + 32,
    };
    updateDesign({ ...design, elements: [...design.elements, duplicate] });
    setSelectedId(duplicate.id);
  };

  const handleImageUpload = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notifyUserError("Choose an image file to add to your design.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        notifyUserError("This image could not be added to your design.");
        return;
      }
      const image = new window.Image();
      image.onload = () => {
        const maxSize = Math.min(design.width, design.height) * 0.55;
        const ratio = Math.min(maxSize / image.width, maxSize / image.height, 1);
        const element: DesignElement = {
          id: `image-${Date.now()}`,
          type: "image",
          x: Math.round((design.width - image.width * ratio) / 2),
          y: Math.round((design.height - image.height * ratio) / 2),
          width: Math.round(image.width * ratio),
          height: Math.round(image.height * ratio),
          fill: "#ffffff",
          src: reader.result as string,
        };
        updateDesign({ ...design, elements: [...design.elements, element] });
        setSelectedId(element.id);
      };
      image.onerror = () => notifyUserError("This image could not be decoded.");
      image.src = reader.result;
    };
    reader.onerror = () => notifyUserError("This image could not be read.");
    reader.readAsDataURL(file);
  };

  const finishTransform = (node: Konva.Node, type: ElementType) => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const width = Math.max(24, node.width() * scaleX);
    const height = Math.max(24, node.height() * scaleY);
    node.scaleX(1);
    node.scaleY(1);
    updateElement(node.id(), {
      x: node.x() - (type === "triangle" ? width / 2 : 0),
      y: node.y() - (type === "triangle" ? height / 2 : 0),
      width,
      height,
      rotation: node.rotation(),
    });
  };

  const exportDesign = () => {
    const stage = stageRef.current;
    if (!stage) {
      notifyUserError("The design canvas is not ready to export.");
      return;
    }
    const transformer = transformerRef.current;
    transformer?.hide();
    stage.batchDraw();
    try {
      const dataUrl = stage.toDataURL({
        pixelRatio: 1 / scale,
        mimeType: "image/png",
      });
      const link = document.createElement("a");
      link.download = "design-studio.png";
      link.href = dataUrl;
      link.click();
    } catch {
      notifyUserError("The design could not be exported. Try removing very large images.");
    } finally {
      transformer?.show();
      stage.batchDraw();
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelected();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        deleteSelected();
      } else if (event.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const selectedControls = selectedElement ? (
    <div className="space-y-4">
      {selectedElement.type !== "image" && (
      <label className="block text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Color
        <div className="mt-2 flex items-center gap-2">
          <input
            type="color"
            aria-label="Selected element color"
            value={selectedElement.fill}
            onChange={(event) => updateElement(selectedElement.id, { fill: event.target.value })}
            className="h-9 w-10 cursor-pointer rounded-lg border border-ui bg-surface p-1"
          />
          <span className="font-mono text-xs font-normal text-ink-secondary">{selectedElement.fill}</span>
        </div>
      </label>
      )}
      {selectedElement.type === "text" && (
        <>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Text
            <textarea
              value={selectedElement.text ?? ""}
              onChange={(event) => updateElement(selectedElement.id, { text: event.target.value })}
              rows={4}
              className="mt-2 w-full resize-y rounded-xl border border-ui bg-surface px-3 py-2 text-sm font-normal normal-case text-ink-primary outline-none focus:border-action"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Font size
            <input
              type="number"
              min={12}
              max={240}
              value={selectedElement.fontSize ?? 48}
              onChange={(event) =>
                updateElement(selectedElement.id, {
                  fontSize: Math.min(240, Math.max(12, Number(event.target.value) || 12)),
                })
              }
              className="mt-2 w-full rounded-xl border border-ui bg-surface px-3 py-2 text-sm font-normal text-ink-primary outline-none focus:border-action"
            />
          </label>
          <button
            type="button"
            onClick={() => updateElement(selectedElement.id, { bold: !selectedElement.bold })}
            aria-pressed={Boolean(selectedElement.bold)}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${selectedElement.bold ? "border-action bg-action-subtle text-action" : "border-ui text-ink-secondary"}`}
          >
            Bold
          </button>
        </>
      )}
      <div className="flex gap-2 border-t border-ui pt-3">
        <button
          type="button"
          onClick={duplicateSelected}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-ui px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-surface-subtle"
        >
          <Copy className="h-4 w-4" aria-hidden="true" /> Duplicate
        </button>
        <button
          type="button"
          onClick={deleteSelected}
          aria-label="Delete selected element"
          className="rounded-xl border border-danger-border px-3 py-2 text-danger hover:bg-danger-subtle"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  ) : (
    <p className="text-sm leading-6 text-ink-muted">Select an element on the canvas to edit its style and position.</p>
  );

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-muted">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-ui bg-surface px-4 py-2 sm:px-6">
        <div className="flex items-center gap-3">
          <BackToToolsButton onClick={onClose} toolName="Design Studio" />
          <div className="hidden border-l border-ui pl-3 sm:block">
            <h1 className="text-sm font-bold text-ink-primary">Design Studio</h1>
            <p className="text-xs text-ink-muted">{saved ? "Saved on this device" : "Save unavailable"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={`${design.width}x${design.height}`}
            onChange={(event) => {
              const size = SIZES.find((item) => `${item.width}x${item.height}` === event.target.value);
              if (size) updateDesign({ ...design, width: size.width, height: size.height });
            }}
            aria-label="Canvas size"
            className="max-w-40 rounded-lg border border-ui bg-surface px-2 py-2 text-xs text-ink-secondary outline-none focus:border-action sm:max-w-none sm:text-sm"
          >
            {SIZES.map((size) => (
              <option key={size.label} value={`${size.width}x${size.height}`}>{size.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={undo}
            disabled={!past.length}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            className="rounded-lg border border-ui p-2 text-ink-secondary hover:bg-surface-subtle disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!future.length}
            aria-label="Redo"
            title="Redo (Ctrl+Y)"
            className="rounded-lg border border-ui p-2 text-ink-secondary hover:bg-surface-subtle disabled:opacity-40"
          >
            <Redo2 className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={exportDesign}
            className="inline-flex items-center gap-2 rounded-xl bg-action px-3 py-2 text-sm font-semibold text-ink-inverse hover:bg-action-hover sm:px-4"
          >
            <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Download PNG</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[150px_minmax(0,1fr)] xl:grid-cols-[190px_minmax(0,1fr)_250px]">
        <aside className="flex min-h-0 flex-col gap-5 overflow-y-auto border-r border-ui bg-surface p-3 sm:p-4">
          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-muted">Add elements</h2>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => addElement("text")} className="flex flex-col items-center gap-2 rounded-xl border border-ui p-3 text-xs font-semibold text-ink-secondary hover:border-action-border-strong hover:bg-action-subtle">
                <Type className="h-5 w-5 text-action" aria-hidden="true" /> Text
              </button>
              <button type="button" onClick={() => addElement("rect")} className="flex flex-col items-center gap-2 rounded-xl border border-ui p-3 text-xs font-semibold text-ink-secondary hover:border-action-border-strong hover:bg-action-subtle">
                <Square className="h-5 w-5 text-action" aria-hidden="true" /> Rectangle
              </button>
              <button type="button" onClick={() => addElement("circle")} className="flex flex-col items-center gap-2 rounded-xl border border-ui p-3 text-xs font-semibold text-ink-secondary hover:border-action-border-strong hover:bg-action-subtle">
                <Circle className="h-5 w-5 text-action" aria-hidden="true" /> Circle
              </button>
              <button type="button" onClick={() => addElement("triangle")} className="flex flex-col items-center gap-2 rounded-xl border border-ui p-3 text-xs font-semibold text-ink-secondary hover:border-action-border-strong hover:bg-action-subtle">
                <span className="text-lg leading-5 text-action" aria-hidden="true">△</span> Triangle
              </button>
              <button type="button" onClick={() => imageInputRef.current?.click()} className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-dashed border-ui-strong p-3 text-xs font-semibold text-ink-secondary hover:border-action-border-strong hover:bg-action-subtle">
                <ImagePlus className="h-4 w-4 text-action" aria-hidden="true" /> Add image
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  handleImageUpload(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-muted">Background</h2>
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => updateDesign({ ...design, background: color })}
                  aria-label={`Set background ${color}`}
                  aria-pressed={design.background === color}
                  className={`h-7 w-7 rounded-full border border-ui-strong ${design.background === color ? "ring-2 ring-action ring-offset-2" : ""}`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border border-ui-strong" title="Custom background color">
                <input
                  type="color"
                  value={design.background}
                  onChange={(event) => updateDesign({ ...design, background: event.target.value })}
                  aria-label="Custom background color"
                  className="absolute -left-2 -top-2 h-11 w-11 cursor-pointer"
                />
              </label>
            </div>
          </section>

          <section className="min-h-0 flex-1">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
              <Layers className="h-4 w-4" aria-hidden="true" /> Layers
            </h2>
            <div className="space-y-1">
              {design.elements.slice().reverse().map((element) => (
                <button
                  type="button"
                  key={element.id}
                  onClick={() => setSelectedId(element.id)}
                  className={`w-full truncate rounded-lg px-2 py-2 text-left text-xs ${selectedId === element.id ? "bg-action-subtle font-semibold text-action" : "text-ink-secondary hover:bg-surface-subtle"}`}
                >
                  {element.type === "text" ? element.text || "Text" : element.type === "image" ? "Image" : `${element.type[0].toUpperCase()}${element.type.slice(1)}`}
                </button>
              ))}
              {!design.elements.length && <p className="text-xs text-ink-muted">Your layers will appear here.</p>}
            </div>
          </section>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-ui bg-surface px-3 sm:px-5">
            <span className="text-xs text-ink-muted">{design.width} × {design.height} px</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom((value) => Math.max(0.25, Math.round((value - 0.1) * 10) / 10))}
                aria-label="Zoom out"
                className="rounded-lg p-1.5 text-ink-secondary hover:bg-surface-subtle"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="w-10 text-center text-xs tabular-nums text-ink-secondary">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoom((value) => Math.min(1.5, Math.round((value + 0.1) * 10) / 10))}
                aria-label="Zoom in"
                className="rounded-lg p-1.5 text-ink-secondary hover:bg-surface-subtle"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div
            ref={stageAreaRef}
            className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-surface-subtle p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedId(null);
            }}
          >
            {workspaceSize.width > 0 && (
              <div className="shrink-0 overflow-hidden bg-surface shadow-xl ring-1 ring-ink-primary/10">
                <Stage
                  ref={stageRef}
                  width={stageWidth}
                  height={stageHeight}
                  onMouseDown={(event) => {
                    if (event.target === event.target.getStage()) setSelectedId(null);
                  }}
                  onTouchStart={(event) => {
                    if (event.target === event.target.getStage()) setSelectedId(null);
                  }}
                >
                  <Layer scaleX={scale} scaleY={scale}>
                    <Rect
                      x={0}
                      y={0}
                      width={design.width}
                      height={design.height}
                      fill={design.background}
                      listening={false}
                    />
                    {design.elements.map((element) => {
                      const onSelect = () => setSelectedId(element.id);
                      const onDragEnd = (node: Konva.Node) =>
                        updateElement(element.id, {
                          x: node.x() - (element.type === "triangle" ? element.width / 2 : 0),
                          y: node.y() - (element.type === "triangle" ? element.height / 2 : 0),
                        });
                      const onTransformEnd = (node: Konva.Node) => finishTransform(node, element.type);
                      const selected = selectedId === element.id;
                      const common = {
                        id: element.id,
                        x: element.x,
                        y: element.y,
                        width: element.width,
                        height: element.height,
                        rotation: element.rotation ?? 0,
                        fill: element.fill,
                        draggable: true,
                        onClick: onSelect,
                        onTap: onSelect,
                        onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => onDragEnd(event.target),
                        onTransformEnd: (event: Konva.KonvaEventObject<Event>) => onTransformEnd(event.target),
                      };
                      if (element.type === "text") {
                        return (
                          <KonvaText
                            {...common}
                            key={element.id}
                            text={element.text ?? ""}
                            fontSize={element.fontSize ?? 48}
                            fontFamily={element.fontFamily ?? "Arial"}
                            fontStyle={element.bold ? "bold" : "normal"}
                            wrap="word"
                            verticalAlign="middle"
                            padding={8}
                            stroke={selected ? "#0f766e" : undefined}
                            strokeWidth={selected ? 1 : 0}
                          />
                        );
                      }
                      if (element.type === "rect") {
                        return <Rect {...common} key={element.id} cornerRadius={12} />;
                      }
                      if (element.type === "circle") {
                        return <Rect {...common} key={element.id} cornerRadius={Math.min(element.width, element.height) / 2} />;
                      }
                      if (element.type === "triangle") {
                        return (
                          <RegularPolygon
                            {...common}
                            key={element.id}
                            x={element.x + element.width / 2}
                            y={element.y + element.height / 2}
                            sides={3}
                            radius={Math.min(element.width, element.height) / 2}
                          />
                        );
                      }
                      return (
                        <UploadedImage
                          key={element.id}
                          element={element}
                          selected={selected}
                          onSelect={onSelect}
                          onDragEnd={onDragEnd}
                          onTransformEnd={onTransformEnd}
                        />
                      );
                    })}
                    <Transformer
                      ref={transformerRef}
                      rotateEnabled
                      keepRatio={selectedElement?.type === "triangle"}
                      borderStroke="#0f766e"
                      anchorStroke="#0f766e"
                      anchorFill="#ffffff"
                      anchorSize={10}
                      boundBoxFunc={(oldBox, newBox) =>
                        newBox.width < 24 || newBox.height < 24 ? oldBox : newBox
                      }
                    />
                  </Layer>
                </Stage>
              </div>
            )}
          </div>
          {selectedElement && (
            <div className="max-h-44 shrink-0 overflow-y-auto border-t border-ui bg-surface p-3 xl:hidden">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Element settings</h2>
                <button type="button" onClick={() => setSelectedId(null)} aria-label="Deselect element" className="text-ink-muted hover:text-ink-primary">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {selectedControls}
            </div>
          )}
        </section>

        <aside className="hidden min-h-0 flex-col gap-5 overflow-y-auto border-l border-ui bg-surface p-4 xl:flex">
          <section>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-ink-muted">
              {selectedElement ? "Element settings" : "Design"}
            </h2>
            {selectedControls}
          </section>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl border border-ui px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-surface-subtle"
          >
            <X className="h-4 w-4" aria-hidden="true" /> Deselect
          </button>
        </aside>
      </div>
    </main>
  );
}