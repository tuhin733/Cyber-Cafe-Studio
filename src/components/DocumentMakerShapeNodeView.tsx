import { useRef, useState, type PointerEvent } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
  DEFAULT_DOCUMENT_MAKER_SHAPE,
  getDocumentMakerShapeColor,
  getDocumentMakerShapeMarkup,
  isDocumentMakerShapeType,
  type DocumentMakerShapeAttributes,
} from "../lib/documentMakerShapes";

interface Interaction {
  pointerId: number;
  mode: "move" | "resize";
  clientX: number;
  clientY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  current: { x: number; y: number; width: number; height: number };
}

export default function DocumentMakerShapeNodeView({
  editor,
  getPos,
  node,
  selected,
  updateAttributes,
}: NodeViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const [preview, setPreview] = useState<Interaction["current"] | null>(null);
  const attrs = node.attrs as DocumentMakerShapeAttributes;
  const x = preview?.x ?? attrs.x;
  const y = preview?.y ?? attrs.y;
  const width = preview?.width ?? attrs.width;
  const height = preview?.height ?? attrs.height;
  const shapeType = isDocumentMakerShapeType(attrs.shapeType) ? attrs.shapeType : "rectangle";
  const shape = getDocumentMakerShapeMarkup(shapeType);
  const fill = getDocumentMakerShapeColor(attrs.fill, DEFAULT_DOCUMENT_MAKER_SHAPE.fill);
  const stroke = getDocumentMakerShapeColor(attrs.stroke, DEFAULT_DOCUMENT_MAKER_SHAPE.stroke);
  const rotation = Number.isFinite(Number(attrs.rotation)) ? Number(attrs.rotation) : 0;

  const beginInteraction = (
    event: PointerEvent<HTMLElement | SVGSVGElement>,
    mode: Interaction["mode"],
  ) => {
    if (event.button !== 0) return;
    const wrapper = wrapperRef.current;
    const page = wrapper?.closest<HTMLElement>(".document-maker-page");
    if (!wrapper || !page) return;
    const pageBounds = page.getBoundingClientRect();
    const pageWidth = Number.parseFloat(page.style.width) || pageBounds.width;
    const scale = pageBounds.width / pageWidth || 1;
    event.preventDefault();
    event.stopPropagation();
    const position = getPos();
    if (typeof position === "number") editor.commands.setNodeSelection(position);
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = {
      pointerId: event.pointerId,
      mode,
      clientX: event.clientX,
      clientY: event.clientY,
      x: attrs.x,
      y: attrs.y,
      width: attrs.width,
      height: attrs.height,
      scale,
      current: { x: attrs.x, y: attrs.y, width: attrs.width, height: attrs.height },
    };
  };

  const moveInteraction = (event: PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    const dx = (event.clientX - interaction.clientX) / interaction.scale;
    const dy = (event.clientY - interaction.clientY) / interaction.scale;
    const page = wrapperRef.current?.closest<HTMLElement>(".document-maker-page");
    if (!page) return;
    const pageWidth = Number.parseFloat(page.style.width) || page.clientWidth;
    const pageHeight = Number.parseFloat(page.style.height) || page.clientHeight;
    const next = interaction.mode === "move"
      ? {
          ...interaction.current,
          x: Math.max(0, Math.min(pageWidth - interaction.width, interaction.x + dx)),
          y: Math.max(0, Math.min(pageHeight - interaction.height, interaction.y + dy)),
        }
      : {
          x: interaction.x,
          y: interaction.y,
          width: Math.max(20, Math.min(pageWidth - interaction.x, interaction.width + dx)),
          height: Math.max(20, Math.min(pageHeight - interaction.y, interaction.height + dy)),
        };
    interaction.current = next;
    setPreview(next);
  };

  const finishInteraction = (event: PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    interactionRef.current = null;
    updateAttributes({
      x: Math.round(interaction.current.x),
      y: Math.round(interaction.current.y),
      width: Math.round(interaction.current.width),
      height: Math.round(interaction.current.height),
    });
    setPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const style = {
    position: "absolute" as const,
    left: x,
    top: y,
    width,
    height,
    opacity: Math.max(0, Math.min(1, Number(attrs.opacity) || 1)),
    transform: `rotate(${rotation}deg)`,
    filter: attrs.shadow ? "drop-shadow(2px 3px 3px #00000040)" : undefined,
    zIndex: selected ? 4 : 2,
  };

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      as="div"
      className={`document-maker-shape-node ${selected ? "is-selected" : ""}`}
      data-shape-type={shapeType}
      style={style}
      onPointerMove={moveInteraction}
      onPointerUp={finishInteraction}
      onPointerCancel={finishInteraction}
    >
      {shapeType === "textBox" ? (
        <textarea
          aria-label="Text box"
          className="document-maker-text-box"
          value={attrs.text}
          placeholder="Type here"
          style={{
            borderColor: stroke,
            borderWidth: attrs.strokeWidth,
            borderStyle: attrs.dashed ? "dashed" : "solid",
            background: fill === "none" ? "transparent" : fill,
            color: "var(--theme-ink-primary)",
          }}
          onPointerDown={(event) => {
            const position = getPos();
            if (typeof position === "number") editor.commands.setNodeSelection(position);
            const bounds = event.currentTarget.getBoundingClientRect();
            const edge = 10;
            if (
              event.clientX - bounds.left < edge ||
              bounds.right - event.clientX < edge ||
              event.clientY - bounds.top < edge ||
              bounds.bottom - event.clientY < edge
            ) {
              beginInteraction(event, "move");
            } else {
              event.stopPropagation();
            }
          }}
          onChange={(event) => updateAttributes({ text: event.currentTarget.value })}
        />
      ) : (
        <svg
          className="document-maker-shape-svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-label={shapeType}
          onPointerDown={(event) => beginInteraction(event, "move")}
          role="img"
        >
          <title>{shapeType}</title>
          <g
            fill={fill === "none" || shapeType === "line" ? "none" : fill}
            stroke={stroke}
            strokeWidth={attrs.strokeWidth}
            strokeDasharray={attrs.dashed ? "6 4" : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          >
            {shape[0] === "line" ? (
              <line {...shape[1]} />
            ) : shape[0] === "path" ? (
              <path {...shape[1]} />
            ) : shape[0] === "ellipse" ? (
              <ellipse {...shape[1]} />
            ) : (
              <rect {...shape[1]} />
            )}
          </g>
        </svg>
      )}
      {selected && (
        <button
          type="button"
          className="document-maker-shape-resize-handle"
          aria-label="Resize shape"
          title="Drag to resize"
          onPointerDown={(event) => beginInteraction(event, "resize")}
          onKeyDown={(event) => {
            if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
            event.preventDefault();
            updateAttributes({
              width: Math.max(20, attrs.width + (event.key === "ArrowRight" ? 5 : event.key === "ArrowLeft" ? -5 : 0)),
              height: Math.max(20, attrs.height + (event.key === "ArrowDown" ? 5 : event.key === "ArrowUp" ? -5 : 0)),
            });
          }}
        />
      )}
    </NodeViewWrapper>
  );
}
