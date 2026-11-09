import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow as BaseTableRow,
  TableView,
} from "@tiptap/extension-table";
import { FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { Node as TiptapNode } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import DocumentMakerImageNodeView from "../components/DocumentMakerImageNodeView";
import DocumentMakerShapeNodeView from "../components/DocumentMakerShapeNodeView";
import {
  DEFAULT_DOCUMENT_MAKER_SHAPE,
  getDocumentMakerShapeColor,
  isDocumentMakerShapeType,
  getDocumentMakerShapeMarkup,
} from "./documentMakerShapes";

const TableRow = BaseTableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      rowHeight: {
        default: null,
        parseHTML: (element) => {
          const height = Number.parseFloat(element.getAttribute("data-row-height") ?? "");
          return Number.isFinite(height) && height > 0 ? height : null;
        },
        renderHTML: ({ rowHeight }) =>
          typeof rowHeight === "number"
            ? {
                "data-row-height": rowHeight,
                style: `height: ${rowHeight}px`,
              }
            : {},
      },
    };
  },
});

const DocumentImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const width = Number.parseFloat(element.getAttribute("width") ?? "");
          return Number.isFinite(width) && width > 0 ? width : null;
        },
        renderHTML: ({ width }) =>
          typeof width === "number"
            ? { width, style: `width:${width}px;max-width:100%;height:auto` }
            : {},
      },
      align: {
        default: "left",
        parseHTML: (element) => element.getAttribute("data-align") ?? "left",
        renderHTML: ({ align }) => ({ "data-align": align }),
      },
      rotation: {
        default: 0,
        parseHTML: (element) => {
          const rotation = Number.parseInt(element.getAttribute("data-rotation") ?? "0", 10);
          return Number.isFinite(rotation) ? ((rotation % 360) + 360) % 360 : 0;
        },
        renderHTML: ({ rotation }) => ({ "data-rotation": rotation }),
      },
      x: {
        default: null,
        parseHTML: (element) => {
          const x = Number.parseFloat(element.getAttribute("data-position-x") ?? "");
          return Number.isFinite(x) ? x : null;
        },
        renderHTML: ({ x }) => typeof x === "number" ? { "data-position-x": x } : {},
      },
      y: {
        default: null,
        parseHTML: (element) => {
          const y = Number.parseFloat(element.getAttribute("data-position-y") ?? "");
          return Number.isFinite(y) ? y : null;
        },
        renderHTML: ({ y }) => typeof y === "number" ? { "data-position-y": y } : {},
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(DocumentMakerImageNodeView);
  },
  renderHTML({ HTMLAttributes }) {
    const styleParts = [
      typeof HTMLAttributes.width === "number"
        ? `width:${HTMLAttributes.width}px;max-width:100%;height:auto`
        : "",
      typeof HTMLAttributes["data-position-x"] === "number" &&
        typeof HTMLAttributes["data-position-y"] === "number"
        ? `position:absolute;left:${HTMLAttributes["data-position-x"]}px;top:${HTMLAttributes["data-position-y"]}px`
        : "",
    ].filter(Boolean);
    return [
      "img",
      {
        ...HTMLAttributes,
        class: "document-maker-image",
        style: styleParts.join(";"),
        draggable: "false",
      },
    ];
  },
});

const PageBreak = TiptapNode.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: "div[data-page-break]" }],
  renderHTML: () => ["div", { "data-page-break": "true", class: "document-maker-page-break" }],
});

const DocumentShape = TiptapNode.create({
  name: "documentShape",
  group: "block",
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      shapeType: {
        default: "rectangle",
        parseHTML: (element) => {
          const value = element.getAttribute("data-shape-type");
          return isDocumentMakerShapeType(value) ? value : "rectangle";
        },
        renderHTML: ({ shapeType }) => ({ "data-shape-type": shapeType }),
      },
      x: { default: 80, parseHTML: (element) => Number(element.getAttribute("data-x")) || 0, renderHTML: ({ x }) => ({ "data-x": x }) },
      y: { default: 80, parseHTML: (element) => Number(element.getAttribute("data-y")) || 0, renderHTML: ({ y }) => ({ "data-y": y }) },
      width: { default: 160, parseHTML: (element) => Number(element.getAttribute("data-width")) || 160, renderHTML: ({ width }) => ({ "data-width": width }) },
      height: { default: 100, parseHTML: (element) => Number(element.getAttribute("data-height")) || 100, renderHTML: ({ height }) => ({ "data-height": height }) },
      fill: { default: DEFAULT_DOCUMENT_MAKER_SHAPE.fill, parseHTML: (element) => element.getAttribute("data-fill") ?? DEFAULT_DOCUMENT_MAKER_SHAPE.fill, renderHTML: ({ fill }) => ({ "data-fill": fill }) },
      stroke: { default: DEFAULT_DOCUMENT_MAKER_SHAPE.stroke, parseHTML: (element) => element.getAttribute("data-stroke") ?? DEFAULT_DOCUMENT_MAKER_SHAPE.stroke, renderHTML: ({ stroke }) => ({ "data-stroke": stroke }) },
      strokeWidth: { default: DEFAULT_DOCUMENT_MAKER_SHAPE.strokeWidth, parseHTML: (element) => Number(element.getAttribute("data-stroke-width")) || DEFAULT_DOCUMENT_MAKER_SHAPE.strokeWidth, renderHTML: ({ strokeWidth }) => ({ "data-stroke-width": strokeWidth }) },
      opacity: { default: 1, parseHTML: (element) => Number(element.getAttribute("data-opacity")) || 1, renderHTML: ({ opacity }) => ({ "data-opacity": opacity }) },
      rotation: { default: 0, parseHTML: (element) => Number(element.getAttribute("data-rotation")) || 0, renderHTML: ({ rotation }) => ({ "data-rotation": rotation }) },
      dashed: { default: false, parseHTML: (element) => element.getAttribute("data-dashed") === "true", renderHTML: ({ dashed }) => ({ "data-dashed": dashed }) },
      shadow: { default: false, parseHTML: (element) => element.getAttribute("data-shadow") === "true", renderHTML: ({ shadow }) => ({ "data-shadow": shadow }) },
      text: { default: "", parseHTML: (element) => element.textContent ?? "", renderHTML: () => ({}) },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-document-maker-shape]" }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(DocumentMakerShapeNodeView);
  },
  renderHTML({ node, HTMLAttributes }) {
    const { shapeType, x, y, width, height, strokeWidth, opacity, rotation, dashed, shadow, text } = node.attrs;
    const fill = getDocumentMakerShapeColor(node.attrs.fill, DEFAULT_DOCUMENT_MAKER_SHAPE.fill);
    const stroke = getDocumentMakerShapeColor(node.attrs.stroke, DEFAULT_DOCUMENT_MAKER_SHAPE.stroke);
    const safeOpacity = Math.max(0, Math.min(1, Number(opacity) || 1));
    const style = [
      `position:absolute;left:${x}px;top:${y}px;width:${width}px;height:${height}px`,
      `opacity:${safeOpacity};transform:rotate(${rotation}deg)`,
      shadow ? "filter:drop-shadow(2px 3px 3px #00000040)" : "",
      shapeType === "textBox"
        ? `box-sizing:border-box;border:${strokeWidth}px ${dashed ? "dashed" : "solid"} ${stroke};background:${fill === "none" ? "transparent" : fill};padding:6px;color:#0f172a;white-space:pre-wrap;overflow:hidden`
        : "",
    ].filter(Boolean).join(";");
    const attrs = { ...HTMLAttributes, "data-document-maker-shape": "true", style };
    if (shapeType === "textBox") return ["div", attrs, text || ""];
    const shape = getDocumentMakerShapeMarkup(shapeType);
    const shapeAttrs = {
      ...shape[1],
      fill: fill === "none" || shapeType === "line" ? "none" : fill,
      stroke,
      "stroke-width": String(strokeWidth),
      "stroke-dasharray": dashed ? "6 4" : undefined,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "vector-effect": "non-scaling-stroke",
    };
    return [
      "div",
      attrs,
      [
        "svg",
        { viewBox: "0 0 100 100", preserveAspectRatio: "none", width: "100%", height: "100%" },
        [shape[0], shapeAttrs],
      ],
    ];
  },
});

class MovableTableView extends TableView {
  constructor(
    node: ConstructorParameters<typeof TableView>[0],
    cellMinWidth: number,
    view: ConstructorParameters<typeof TableView>[2],
    htmlAttributes?: ConstructorParameters<typeof TableView>[3],
  ) {
    super(node, cellMinWidth, view, htmlAttributes);
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "document-maker-table-drag-handle";
    handle.dataset.tableDragHandle = "true";
    handle.setAttribute("aria-label", "Move table");
    handle.setAttribute("title", "Drag to move table");
    handle.textContent = "⠿";
    this.dom.prepend(handle);
  }
}

export const DOCUMENT_MAKER_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2] },
    underline: false,
    link: false,
  }),
  Underline,
  Placeholder.configure({
    placeholder: "Start typing or paste your document here...",
  }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
  }),
  FontFamily,
  FontSize,
  DocumentImage.configure({
    allowBase64: true,
    HTMLAttributes: {
      class: "document-maker-image",
      title: "Drag to resize. Right-click for image options.",
    },
  }),
  DocumentShape,
  Table.configure({ resizable: true, View: MovableTableView }),
  TableRow,
  TableHeader,
  TableCell,
  PageBreak,
];
