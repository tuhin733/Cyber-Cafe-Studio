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
import { Extension, Node as TiptapNode } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import DocumentMakerImageNodeView from "../components/DocumentMakerImageNodeView";

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

const isDocumentMakerColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[\da-f]{6}$/i.test(value);

const DocumentFormatting = Extension.create({
  name: "documentFormatting",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          documentStyle: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-document-style"),
            renderHTML: ({ documentStyle }) =>
              typeof documentStyle === "string"
                ? { "data-document-style": documentStyle }
                : {},
          },
          documentSpacing: {
            default: null,
            parseHTML: (element) => {
              const lineHeight = Number.parseFloat(
                element.getAttribute("data-document-line-height") ?? element.style.lineHeight,
              );
              const paragraphSpacing = Number.parseFloat(
                element.getAttribute("data-document-paragraph-spacing") ?? element.style.marginBottom,
              );
              if (!Number.isFinite(lineHeight) && !Number.isFinite(paragraphSpacing)) return null;
              return {
                lineHeight: Number.isFinite(lineHeight) ? lineHeight : null,
                paragraphSpacing: Number.isFinite(paragraphSpacing) ? paragraphSpacing : null,
              };
            },
            renderHTML: ({ documentSpacing }) => {
              if (!documentSpacing || typeof documentSpacing !== "object") return {};
              const { lineHeight, paragraphSpacing } = documentSpacing as {
                lineHeight?: unknown;
                paragraphSpacing?: unknown;
              };
              const styles = [
                typeof lineHeight === "number" && lineHeight >= 1 && lineHeight <= 2
                  ? `line-height:${lineHeight}`
                  : "",
                typeof paragraphSpacing === "number" && paragraphSpacing >= 0 && paragraphSpacing <= 48
                  ? `margin-bottom:${paragraphSpacing}px`
                  : "",
              ].filter(Boolean);
              return {
                ...(typeof lineHeight === "number" && lineHeight >= 1 && lineHeight <= 2
                  ? { "data-document-line-height": lineHeight }
                  : {}),
                ...(typeof paragraphSpacing === "number" && paragraphSpacing >= 0 && paragraphSpacing <= 48
                  ? { "data-document-paragraph-spacing": paragraphSpacing }
                  : {}),
                ...(styles.length ? { style: styles.join(";") } : {}),
              };
            },
          },
        },
      },
      {
        types: ["tableCell", "tableHeader"],
        attributes: {
          backgroundColor: {
            default: null,
            parseHTML: (element) => {
              const color = element.getAttribute("data-cell-background") ?? element.style.backgroundColor;
              if (isDocumentMakerColor(color)) return color;
              const rgb = /^rgb\(\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\s*\)$/i.exec(color);
              if (!rgb) return null;
              const channels = rgb.slice(1).map(Number);
              if (channels.some((channel) => channel > 255)) return null;
              return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
            },
            renderHTML: ({ backgroundColor }) =>
              isDocumentMakerColor(backgroundColor)
                ? {
                    "data-cell-background": backgroundColor,
                    style: `background-color:${backgroundColor}`,
                  }
                : {},
          },
          textAlign: {
            default: null,
            parseHTML: (element) => {
              const alignment = element.getAttribute("data-cell-align") ?? element.style.textAlign;
              return ["left", "center", "right"].includes(alignment ?? "") ? alignment : null;
            },
            renderHTML: ({ textAlign }) =>
              ["left", "center", "right"].includes(String(textAlign))
                ? {
                    "data-cell-align": textAlign,
                    style: `text-align:${textAlign}`,
                  }
                : {},
          },
        },
      },
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
  DocumentFormatting,
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
  Table.configure({ resizable: true, View: MovableTableView }),
  TableRow,
  TableHeader,
  TableCell,
  PageBreak,
];
