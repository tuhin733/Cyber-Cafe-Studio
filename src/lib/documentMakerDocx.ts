import { generateJSON, type JSONContent } from "@tiptap/core";
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeadingLevel,
  HorizontalPositionRelativeFrom,
  ImageRun,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  TextWrappingType,
  VerticalPositionRelativeFrom,
  WidthType,
} from "docx";
import { ShapeRun, type PresetShapeType } from "docx/shapes";
import type { DocumentMakerLayout, DocumentMakerPage } from "./documentMaker";
import { getDocumentMakerPageDimensions } from "./documentMaker";
import { DOCUMENT_MAKER_EXTENSIONS } from "./documentMakerExtensions";
import {
  DEFAULT_DOCUMENT_MAKER_SHAPE,
  getDocumentMakerShapeColor,
  isDocumentMakerShapeType,
  type DocumentMakerShapeType,
} from "./documentMakerShapes";

type InlineNode = JSONContent;
type BlockNode = JSONContent;

const alignmentMap: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
  left: AlignmentType.LEFT,
};

function decodeDataUrl(source: string): { data: Uint8Array; type: "png" | "jpg" | "gif" } | null {
  const match = /^data:image\/(png|jpe?g|gif);base64,(.+)$/i.exec(source);
  if (!match) return null;
  const binary = atob(match[2]);
  return {
    data: Uint8Array.from(binary, (character) => character.charCodeAt(0)),
    type: match[1].toLowerCase().startsWith("jp") ? "jpg" : match[1].toLowerCase() as "png" | "gif",
  };
}

function inlineRuns(nodes: InlineNode[] = []): (TextRun | ImageRun | ExternalHyperlink)[] {
  const runs: (TextRun | ImageRun | ExternalHyperlink)[] = [];
  for (const node of nodes) {
    if (node.type === "hardBreak") {
      runs.push(new TextRun({ break: 1 }));
      continue;
    }
    if (node.type === "image") {
      const decoded = typeof node.attrs?.src === "string" ? decodeDataUrl(node.attrs.src) : null;
      if (decoded) {
        const floating = typeof node.attrs?.x === "number" && typeof node.attrs?.y === "number"
          ? {
              horizontalPosition: {
                relative: HorizontalPositionRelativeFrom.PAGE,
                offset: Math.round(node.attrs.x * 9525),
              },
              verticalPosition: {
                relative: VerticalPositionRelativeFrom.PAGE,
                offset: Math.round(node.attrs.y * 9525),
              },
              wrap: { type: TextWrappingType.NONE },
              allowOverlap: true,
            }
          : undefined;
        runs.push(new ImageRun({
          type: decoded.type,
          data: decoded.data,
          transformation: {
            width: Number(node.attrs?.width) || 240,
            height: Number(node.attrs?.height) || 160,
            rotation: Number(node.attrs?.rotation) || 0,
          },
          floating,
        }));
      }
      continue;
    }
    if (node.type !== "text" || !node.text) continue;
    const marks = new Set((node.marks ?? []).map((mark) => mark.type));
    const style = (node.marks ?? []).find((mark) => mark.type === "textStyle")?.attrs ?? {};
    const link = (node.marks ?? []).find((mark) => mark.type === "link")?.attrs?.href;
    const highlight = (node.marks ?? []).find((mark) => mark.type === "highlight")?.attrs?.color;
    const textRun = new TextRun({
        text: node.text,
        bold: marks.has("bold"),
        italics: marks.has("italic"),
        underline: marks.has("underline") ? {} : undefined,
        strike: marks.has("strike"),
        color: typeof style.color === "string" ? style.color.replace("#", "") : undefined,
        size: typeof style.fontSize === "string"
          ? Math.round((Number.parseFloat(style.fontSize) || 16) * 2)
          : undefined,
        font: typeof style.fontFamily === "string" ? style.fontFamily.replace(/["']/g, "") : undefined,
        highlight: typeof highlight === "string" ? "yellow" : undefined,
      });
    runs.push(
      typeof link === "string" && /^https?:\/\//i.test(link)
        ? new ExternalHyperlink({ link, children: [textRun] })
        : textRun,
    );
  }
  return runs;
}

function paragraphFromNode(node: BlockNode, pageBreakBefore = false): Paragraph {
  const headingLevel = node.type === "heading"
    ? Number(node.attrs?.level) === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2
    : undefined;
  return new Paragraph({
    heading: headingLevel,
    children: inlineRuns(node.content),
    alignment: typeof node.attrs?.textAlign === "string"
      ? alignmentMap[node.attrs.textAlign]
      : undefined,
    pageBreakBefore,
  });
}

function tableFromNode(node: BlockNode): Table {
  const rows = (node.content ?? []).map((row) =>
    new TableRow({
      children: (row.content ?? []).map((cell) =>
        new TableCell({
          children: (cell.content ?? []).map((child) =>
            child.type === "paragraph" || child.type === "heading"
              ? paragraphFromNode(child)
              : new Paragraph({ children: inlineRuns(child.content) }),
          ),
          shading: cell.type === "tableHeader" ? { fill: "F1F5F9" } : undefined,
          width: { size: 100 / Math.max(1, row.content?.length ?? 1), type: WidthType.PERCENTAGE },
        }),
      ),
      tableHeader: row.content?.some((cell) => cell.type === "tableHeader"),
    }),
  );
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

function shapeFromNode(node: BlockNode): ShapeRun {
  const attrs = node.attrs ?? {};
  const shapeTypes: Record<DocumentMakerShapeType, PresetShapeType> = {
    rectangle: "rectangle",
    roundedRectangle: "roundedRectangle",
    ellipse: "ellipse",
    line: "line",
    arrow: "rightArrow",
    triangle: "triangle",
    callout: "rectangularCallout",
    textBox: "rectangle",
  };
  const shapeType = isDocumentMakerShapeType(attrs.shapeType)
    ? attrs.shapeType
    : "rectangle";
  const opacity = Math.max(0, Math.min(1, Number(attrs.opacity) || 1));
  const normalizedFill = getDocumentMakerShapeColor(attrs.fill, DEFAULT_DOCUMENT_MAKER_SHAPE.fill);
  const normalizedStroke = getDocumentMakerShapeColor(attrs.stroke, DEFAULT_DOCUMENT_MAKER_SHAPE.stroke);
  const fill = normalizedFill === "none" ? "none" : normalizedFill.slice(1).toUpperCase();
  const stroke = normalizedStroke.slice(1).toUpperCase();
  const width = Math.max(1, Number(attrs.width) || 160);
  const height = Math.max(1, Number(attrs.height) || 100);
  const x = Math.max(0, Number(attrs.x) || 0);
  const y = Math.max(0, Number(attrs.y) || 0);
  const strokeWidth = Math.max(1, Number(attrs.strokeWidth) || 2);
  return new ShapeRun({
    type: shapeTypes[shapeType],
    transformation: {
      width,
      height,
      rotation: Number(attrs.rotation) || 0,
    },
    floating: {
      horizontalPosition: {
        relative: HorizontalPositionRelativeFrom.PAGE,
        offset: Math.round(x * 9525),
      },
      verticalPosition: {
        relative: VerticalPositionRelativeFrom.PAGE,
        offset: Math.round(y * 9525),
      },
      wrap: { type: TextWrappingType.NONE },
      allowOverlap: true,
    },
    fill: fill.toLowerCase() === "none"
      ? "none"
      : { color: fill, transparency: Math.round((1 - opacity) * 100) },
    line: {
      color: stroke,
      width: strokeWidth * 0.75,
      transparency: Math.round((1 - opacity) * 100),
      dash: attrs.dashed ? "dash" : undefined,
    },
    effects: attrs.shadow ? { shadow: {} } : undefined,
    text: shapeType === "textBox" && typeof attrs.text === "string" ? attrs.text : undefined,
    textOptions: shapeType === "textBox" ? { verticalAlignment: "top" } : undefined,
    altText: { title: shapeType, description: `${shapeType} shape` },
  });
}

function blocksToDocx(pages: DocumentMakerPage[]) {
  return pages.flatMap((page, pageIndex) => {
    const blocks: (Paragraph | Table)[] = [];
    for (const node of page.content.content ?? []) {
      if (node.type === "pageBreak") {
        blocks.push(new Paragraph({ pageBreakBefore: true }));
      } else if (node.type === "documentShape") {
        blocks.push(new Paragraph({ children: [shapeFromNode(node)] }));
      } else if (node.type === "table") {
        blocks.push(tableFromNode(node));
      } else if (node.type === "bulletList" || node.type === "orderedList") {
        for (const item of node.content ?? []) {
          for (const child of item.content ?? []) {
            blocks.push(new Paragraph({
              children: inlineRuns(child.content),
              bullet: node.type === "bulletList" ? { level: 0 } : undefined,
              numbering: node.type === "orderedList" ? { reference: "document-numbering", level: 0 } : undefined,
            }));
          }
        }
      } else {
        blocks.push(paragraphFromNode(node));
      }
    }
    if (pageIndex > 0) blocks.unshift(new Paragraph({ pageBreakBefore: true }));
    return blocks.length ? blocks : [new Paragraph({ pageBreakBefore: pageIndex > 0 })];
  });
}

export async function exportDocumentMakerDocx(
  pages: DocumentMakerPage[],
  layout: DocumentMakerLayout,
  title: string,
): Promise<Blob> {
  const dimensions = getDocumentMakerPageDimensions(layout);
  const footer = layout.footer || layout.pageNumbers
    ? new Footer({
        children: [
          new Paragraph({
            children: [
              new TextRun(layout.footer),
              ...(layout.footer && layout.pageNumbers ? [new TextRun("   ")] : []),
              ...(layout.pageNumbers
                ? [
                    new TextRun("Page "),
                    new TextRun({ children: [PageNumber.CURRENT] }),
                    new TextRun(" of "),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
                  ]
                : []),
            ],
          }),
        ],
      })
    : undefined;
  const header = layout.header
    ? new Header({ children: [new Paragraph({ children: [new TextRun(layout.header)] })] })
    : undefined;
  const document = new Document({
    title,
    numbering: {
      config: [{
        reference: "document-numbering",
        levels: [{
          level: 0,
          format: "decimal",
          text: "%1.",
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 720, hanging: 260 } } },
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: {
            width: Math.round(dimensions.widthMm * 56.6929),
            height: Math.round(dimensions.heightMm * 56.6929),
          },
          margin: {
            top: Math.round(layout.margins.top * 56.6929),
            right: Math.round(layout.margins.right * 56.6929),
            bottom: Math.round(layout.margins.bottom * 56.6929),
            left: Math.round(layout.margins.left * 56.6929),
          },
        },
      },
      footers: footer ? { default: footer } : undefined,
      headers: header ? { default: header } : undefined,
      children: blocksToDocx(pages),
    }],
  });
  return Packer.toBlob(document);
}

export async function importDocumentMakerDocx(file: File): Promise<DocumentMakerPage[]> {
  if (!file.name.toLowerCase().endsWith(".docx")) {
    throw new TypeError("Choose a .docx file. Legacy .doc files are not supported.");
  }
  const mammoth = await import("mammoth/mammoth.browser");
  const converted = await mammoth.convertToHtml({
    arrayBuffer: await file.arrayBuffer(),
    convertImage: mammoth.images.imgElement((image) =>
      image.read("base64").then((imageData) => ({
        src: `data:${image.contentType};base64,${imageData}`,
      })),
    ),
  });
  const content = generateJSON(converted.value, DOCUMENT_MAKER_EXTENSIONS) as JSONContent;
  if (!content.content?.length) {
    return [{ id: crypto.randomUUID(), content: { type: "doc", content: [{ type: "paragraph" }] } }];
  }
  return [{ id: crypto.randomUUID(), content }];
}
