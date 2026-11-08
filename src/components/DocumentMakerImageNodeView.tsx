import { useRef, useState, type PointerEvent } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

type ImageInteraction = {
  pointerId: number;
  mode: "move" | "resize";
  startClientX: number;
  startClientY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  pageWidth: number;
  pageHeight: number;
  rotation: number;
  moved: boolean;
  current: Preview;
};

interface Preview {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function DocumentMakerImageNodeView({
  editor,
  getPos,
  node,
  selected,
  updateAttributes,
}: NodeViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<ImageInteraction | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const sourceWidth = Number(node.attrs.width);
  const sourceHeight = Number(node.attrs.height);
  const positioned = Number.isFinite(node.attrs.x) && Number.isFinite(node.attrs.y);
  const x = preview?.x ?? (positioned ? Number(node.attrs.x) : undefined);
  const y = preview?.y ?? (positioned ? Number(node.attrs.y) : undefined);
  const width = preview?.width ?? (sourceWidth > 0 ? sourceWidth : undefined);

  const beginInteraction = (event: PointerEvent<HTMLElement>, mode: ImageInteraction["mode"]) => {
    if (event.button !== 0) return;
    const wrapper = wrapperRef.current;
    const page = wrapper?.closest<HTMLElement>(".document-maker-page");
    const image = wrapper?.querySelector("img");
    if (!wrapper || !page || !image) return;

    const pageBounds = page.getBoundingClientRect();
    const pageWidth = Number.parseFloat(page.style.width) || pageBounds.width;
    const scale = pageBounds.width / pageWidth || 1;
    const bounds = wrapper.getBoundingClientRect();
    const frame = wrapper.querySelector<HTMLElement>(".document-maker-image-frame");
    const imageWidth = (frame?.offsetWidth || image.offsetWidth || bounds.width / scale) / scale;
    const imageHeight = (frame?.offsetHeight || image.offsetHeight || bounds.height / scale) / scale;
    const currentX = positioned ? Number(node.attrs.x) : (bounds.left - pageBounds.left) / scale;
    const currentY = positioned ? Number(node.attrs.y) : (bounds.top - pageBounds.top) / scale;
    const position = getPos();

    event.preventDefault();
    event.stopPropagation();
    if (typeof position === "number") editor.commands.setNodeSelection(position);
    event.currentTarget.setPointerCapture(event.pointerId);
    const initialPreview = {
      x: currentX,
      y: currentY,
      width: imageWidth,
      height: imageHeight,
    };
    interactionRef.current = {
      pointerId: event.pointerId,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      x: currentX,
      y: currentY,
      width: imageWidth,
      height: imageHeight,
      scale,
      pageWidth,
      pageHeight: pageWidth * pageBounds.height / pageBounds.width,
      rotation: Number(node.attrs.rotation) || 0,
      moved: false,
      current: initialPreview,
    };
    setPreview(initialPreview);
  };

  const moveInteraction = (event: PointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    const deltaX = (event.clientX - interaction.startClientX) / interaction.scale;
    const deltaY = (event.clientY - interaction.startClientY) / interaction.scale;
    if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) interaction.moved = true;
    if (interaction.mode === "move") {
      const radians = interaction.rotation * Math.PI / 180;
      const rotatedWidth =
        Math.abs(interaction.width * Math.cos(radians)) +
        Math.abs(interaction.height * Math.sin(radians));
      const rotatedHeight =
        Math.abs(interaction.width * Math.sin(radians)) +
        Math.abs(interaction.height * Math.cos(radians));
      const insetX = (rotatedWidth - interaction.width) / 2;
      const insetY = (rotatedHeight - interaction.height) / 2;
      const nextX = Math.max(insetX, Math.min(
        Math.max(insetX, interaction.pageWidth - interaction.width - insetX),
        interaction.x + deltaX,
      ));
      const nextY = Math.max(insetY, Math.min(
        Math.max(insetY, interaction.pageHeight - interaction.height - insetY),
        interaction.y + deltaY,
      ));
      interaction.current = { x: nextX, y: nextY, width: interaction.width, height: interaction.height };
      setPreview(interaction.current);
      return;
    }

    const aspect = interaction.width / Math.max(1, interaction.height);
    const radians = interaction.rotation * Math.PI / 180;
    const widthDelta = deltaX * Math.cos(radians) + deltaY * Math.sin(radians);
    const heightDelta = (-deltaX * Math.sin(radians) + deltaY * Math.cos(radians)) * aspect;
    const maxWidth = Math.min(
      Math.max(20, interaction.pageWidth - interaction.x),
      Math.max(20, interaction.pageHeight - interaction.y) * aspect,
    );
    const nextWidth = Math.max(
      Math.min(20, maxWidth),
      Math.min(maxWidth, interaction.width + Math.max(widthDelta, heightDelta)),
    );
    interaction.current = {
      x: interaction.x,
      y: interaction.y,
      width: nextWidth,
      height: nextWidth / aspect,
    };
    setPreview(interaction.current);
  };

  const finishInteraction = (event: PointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    const next = interaction.current;
    interactionRef.current = null;
    if (!interaction.moved) {
      setPreview(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }
    updateAttributes({
      x: Math.round(next.x),
      y: Math.round(next.y),
      width: Math.round(next.width),
      height: Math.round(next.height),
    });
    setPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      as="div"
      className={`document-maker-image-node group ${selected ? "is-selected" : ""}`}
      data-positioned={x !== undefined && y !== undefined ? "true" : undefined}
      style={{
        position: x !== undefined && y !== undefined ? "absolute" : "relative",
        left: x,
        top: y,
        width,
      }}
      onPointerMove={moveInteraction}
      onPointerUp={finishInteraction}
      onPointerCancel={finishInteraction}
    >
      <div
        className="document-maker-image-frame"
        style={{
          width: width ?? "max-content",
          height: preview?.height ?? (sourceHeight > 0 ? sourceHeight : undefined),
          transform: `rotate(${Number(node.attrs.rotation) || 0}deg)`,
        }}
      >
        <img
          className="document-maker-image"
          src={node.attrs.src}
          alt={node.attrs.alt ?? ""}
          title="Click to select. Drag to move."
          draggable={false}
          style={{
            width: width ?? "auto",
            height: preview?.height ?? (sourceHeight > 0 ? sourceHeight : "auto"),
          }}
          onPointerDown={(event) => beginInteraction(event, "move")}
        />
        <button
          type="button"
          className="document-maker-image-resize-handle"
          aria-label="Resize image"
          title="Drag to resize"
          onPointerDown={(event) => beginInteraction(event, "resize")}
          onKeyDown={(event) => {
            if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
            event.preventDefault();
            const currentWidth = sourceWidth || wrapperRef.current?.offsetWidth || 240;
            const currentHeight = sourceHeight || wrapperRef.current?.offsetHeight || 160;
            const aspect = currentWidth / Math.max(1, currentHeight);
            const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
            const nextWidth = Math.max(20, currentWidth + direction * 10);
            updateAttributes({ width: nextWidth, height: Math.round(nextWidth / aspect) });
          }}
        />
      </div>
    </NodeViewWrapper>
  );
}
