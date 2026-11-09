import { generateHTML, type JSONContent } from "@tiptap/core";
import {
  getDocumentMakerContentInsets,
  getDocumentMakerPageDimensions,
  type DocumentMakerLayout,
  type DocumentMakerPage,
} from "./documentMaker";
import { getUploadedDocumentFonts } from "./documentMakerFonts";
import { DOCUMENT_MAKER_EXTENSIONS } from "./documentMakerExtensions";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);

function createPdfPage(
  content: DocumentMakerPage["content"],
  layout: DocumentMakerLayout,
  pageNumber: number,
  pageCount: number,
): HTMLDivElement {
  const dimensions = getDocumentMakerPageDimensions(layout);
  const contentInsets = getDocumentMakerContentInsets(layout);
  const page = document.createElement("div");
  page.style.cssText = [
    `width:${dimensions.widthPx}px`,
    `height:${dimensions.heightPx}px`,
    "position:relative",
    "box-sizing:border-box",
    "overflow:hidden",
    `padding:${layout.margins.top * 96 / 25.4 + contentInsets.topPx}px ${layout.margins.right * 96 / 25.4}px ${layout.margins.bottom * 96 / 25.4 + contentInsets.bottomPx}px ${layout.margins.left * 96 / 25.4}px`,
    "background:#ffffff",
    "color:#0f172a",
    "font-family:Arial,'Noto Sans Bengali','Noto Sans Devanagari',sans-serif",
    "font-size:16px",
    "line-height:1.25",
    "overflow-wrap:anywhere",
  ].join(";");

  const header = layout.header
    ? `<div class="document-header">${escapeHtml(layout.header)}</div>`
    : "";
  const footer = layout.footer || layout.pageNumbers
    ? `<div class="document-footer"><span>${escapeHtml(layout.footer)}</span>${layout.pageNumbers ? `<span class="document-page-number">${pageNumber} / ${pageCount}</span><span></span>` : ""}</div>`
    : "";
  const styles = document.createElement("style");
  styles.textContent = `
    .document-header { position:absolute; top:12px; left:${layout.margins.left * 96 / 25.4}px; right:${layout.margins.right * 96 / 25.4}px; color:#475569; font-size:12px; }
    .document-footer { position:absolute; bottom:12px; left:${layout.margins.left * 96 / 25.4}px; right:${layout.margins.right * 96 / 25.4}px; display:grid; grid-template-columns:1fr auto 1fr; align-items:center; color:#475569; font-size:12px; }
    .document-page-number { grid-column:2; }
    p { margin: 0 0 9px; }
    h1 { margin: 0 0 16px; font-size: 28px; line-height: 1.25; }
    h2 { margin: 0 0 14px; font-size: 22px; line-height: 1.3; }
    ul, ol { margin: 8px 0 12px; padding-left: 28px; }
    ul { list-style: disc; }
    ol { list-style: decimal; }
    img { max-width: 100%; max-height: 600px; object-fit: contain; }
    img[data-align="center"] { display:block; margin-right:auto; margin-left:auto; }
    img[data-align="right"] { display:block; margin-left:auto; }
    img[data-rotation="90"] { transform:rotate(90deg); }
    img[data-rotation="180"] { transform:rotate(180deg); }
    img[data-rotation="270"] { transform:rotate(270deg); }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    a { color:#1d4ed8; text-decoration:underline; }
    .document-maker-page-break { display:none; }
  `;
  page.innerHTML = `${header}${generateHTML(content, DOCUMENT_MAKER_EXTENSIONS)}${footer}`;
  page.prepend(styles);
  return page;
}

export function createDocumentMakerPreviewHtml(
  pages: DocumentMakerPage[],
  layout: DocumentMakerLayout,
): string {
  const dimensions = getDocumentMakerPageDimensions(layout);
  const pageMarkup = pages
    .map((documentPage, index) =>
      `<div class="document-maker-preview-page-shell">${createPdfPage(
        documentPage.content,
        layout,
        index + 1,
        pages.length,
      ).outerHTML}</div>`,
    )
    .join("");
  return `<!doctype html>
    <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      * { box-sizing:border-box; }
      html, body { min-height:100%; margin:0; font-family:Arial,'Noto Sans Bengali','Noto Sans Devanagari',sans-serif; }
      html { background:#e2e8f0; }
      body { display:flex; flex-direction:column; align-items:center; gap:24px; width:100%; min-height:100%; padding:20px; background:radial-gradient(ellipse at top, #f8fafc 0%, #e2e8f0 70%); overflow:auto; }
      .document-maker-preview-page-shell { position:relative; display:flex; flex:0 0 auto; justify-content:center; margin:0 auto; }
      .document-maker-preview-page { position:absolute; top:0; left:50%; flex:0 0 auto; box-shadow:0 18px 48px #0f172a24,0 2px 8px #0f172a18; transform-origin:top center; }
      @media print {
        @page { size:${dimensions.widthMm}mm ${dimensions.heightMm}mm; margin:0; }
        html, body { background:#fff; }
        body { gap:0; padding:0; overflow:visible; }
        .document-maker-preview-page-shell { width:${dimensions.widthPx}px !important; height:${dimensions.heightPx}px !important; page-break-after:always; }
        .document-maker-preview-page-shell:last-child { page-break-after:auto; }
        .document-maker-preview-page { position:relative; top:auto; left:auto; box-shadow:none; transform:none !important; }
      }
    </style></head>
    <body>${pageMarkup.replace(
      /<div style=/g,
      '<div class="document-maker-preview-page" style=',
    )}</body></html>`;
}

function inlinePdfContent(nodes: JSONContent[] = [], availableFonts: Set<string>): unknown[] {
  const result: unknown[] = [];
  for (const node of nodes) {
    if (node.type === "hardBreak") {
      result.push({ text: "\n" });
      continue;
    }
    if (node.type === "image") continue;
    if (node.type !== "text" || !node.text) continue;
    const marks = new Set((node.marks ?? []).map((mark) => mark.type));
    const style = (node.marks ?? []).find((mark) => mark.type === "textStyle")?.attrs ?? {};
    const link = (node.marks ?? []).find((mark) => mark.type === "link")?.attrs?.href;
    const highlight = (node.marks ?? []).find((mark) => mark.type === "highlight")?.attrs?.color;
    const styleFamily = typeof style.fontFamily === "string"
      ? style.fontFamily.replace(/["']/g, "").trim()
      : "";
    const scriptFont = styleFamily && availableFonts.has(styleFamily)
      ? styleFamily
      : /[\u0980-\u09ff]/u.test(node.text)
      ? [...availableFonts].find((family) => /bengali|bangla/i.test(family))
      : /[\u0900-\u097f]/u.test(node.text)
        ? [...availableFonts].find((family) => /devanagari|hindi/i.test(family))
        : undefined;
    result.push({
      text: node.text,
      bold: marks.has("bold"),
      italics: marks.has("italic"),
      decoration: marks.has("underline") ? "underline" : marks.has("strike") ? "lineThrough" : undefined,
      color: typeof style.color === "string" ? style.color : undefined,
      background: typeof highlight === "string" ? highlight : undefined,
      font: availableFonts.has(styleFamily) ? styleFamily : scriptFont ?? "Roboto",
      fontSize: typeof style.fontSize === "string"
        ? Number.parseFloat(style.fontSize) * 0.75
        : undefined,
      link: typeof link === "string" && /^https?:\/\//i.test(link) ? link : undefined,
    });
  }
  return result;
}

function paragraphPdfContent(
  node: JSONContent,
  availableFonts: Set<string>,
  pageBreakBefore = false,
): unknown[] {
  const result: unknown[] = [];
  let textRuns: unknown[] = [];
  const pushText = () => {
    if (!textRuns.length) return;
    result.push({
      text: textRuns,
      fontSize: node.type === "heading" ? (Number(node.attrs?.level) === 1 ? 21 : 16.5) : 12,
      bold: node.type === "heading",
      margin: node.type === "heading" ? [0, 4, 0, 9] : [0, 0, 0, 7],
      alignment: ["left", "center", "right", "justify"].includes(String(node.attrs?.textAlign))
        ? node.attrs?.textAlign
        : "left",
      ...(pageBreakBefore && result.length === 0 ? { pageBreak: "before" } : {}),
    });
    textRuns = [];
  };
  for (const child of node.content ?? []) {
    if (child.type === "image" && typeof child.attrs?.src === "string") {
      pushText();
      const position = typeof child.attrs.x === "number" && typeof child.attrs.y === "number"
        ? {
            absolutePosition: {
              x: child.attrs.x * 72 / 96,
              y: child.attrs.y * 72 / 96,
            },
          }
        : {};
      result.push({
        image: child.attrs.src,
        width: Math.min((Number(child.attrs.width) || 240) * 72 / 96, 720),
        alignment: child.attrs.align === "center" || child.attrs.align === "right"
          ? child.attrs.align
          : "left",
        ...position,
        ...(Object.keys(position).length === 0 ? { margin: [0, 4, 0, 8] } : {}),
      });
    } else {
      textRuns.push(...inlinePdfContent([child], availableFonts));
    }
  }
  pushText();
  if (result.length === 0) {
    result.push({
      text: "",
      margin: [0, 0, 0, 7],
      ...(pageBreakBefore ? { pageBreak: "before" } : {}),
    });
  }
  return result;
}

function blockPdfContent(
  node: JSONContent,
  availableFonts: Set<string>,
  pageBreakBefore = false,
): unknown {
  if (node.type === "pageBreak") return { text: "", pageBreak: "before" };
  if (node.type === "image" && typeof node.attrs?.src === "string") {
    const position = typeof node.attrs.x === "number" && typeof node.attrs.y === "number"
      ? {
          absolutePosition: {
            x: node.attrs.x * 72 / 96,
            y: node.attrs.y * 72 / 96,
          },
        }
      : {};
    return {
      image: node.attrs.src,
      width: Math.min((Number(node.attrs.width) || 240) * 72 / 96, 720),
      alignment: node.attrs.align === "center" || node.attrs.align === "right"
        ? node.attrs.align
        : "left",
      ...position,
      ...(Object.keys(position).length === 0 ? { margin: [0, 4, 0, 8] } : {}),
      ...(pageBreakBefore ? { pageBreak: "before" } : {}),
    };
  }
  if (node.type === "table") {
    return {
      table: {
        headerRows: node.content?.[0]?.content?.some((cell) => cell.type === "tableHeader") ? 1 : 0,
        widths: (node.content?.[0]?.content ?? []).map(() => "*"),
        body: (node.content ?? []).map((row) =>
          (row.content ?? []).map((cell) => {
            const cellBlocks = (cell.content ?? []).flatMap((child) =>
              child.type === "paragraph" || child.type === "heading"
                ? paragraphPdfContent(child, availableFonts)
                : inlinePdfContent(child.content, availableFonts),
            );
            return {
              ...(cellBlocks.length === 1
                ? cellBlocks[0] as Record<string, unknown>
                : { stack: cellBlocks }),
              fillColor: cell.type === "tableHeader" ? "#f1f5f9" : undefined,
              bold: cell.type === "tableHeader",
              margin: [5, 4, 5, 4],
            };
          }),
        ),
      },
      layout: "lightHorizontalLines",
      margin: [0, 4, 0, 10],
      ...(pageBreakBefore ? { pageBreak: "before" } : {}),
    };
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    const items = (node.content ?? []).map((item) => ({
      text: (item.content ?? []).flatMap((child) =>
        inlinePdfContent(child.content, availableFonts),
      ),
    }));
    return {
      [node.type === "bulletList" ? "ul" : "ol"]: items,
      margin: [0, 4, 0, 10],
      ...(pageBreakBefore ? { pageBreak: "before" } : {}),
    };
  }

  return paragraphPdfContent(node, availableFonts, pageBreakBefore);
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function prepareRotatedImages(node: JSONContent): Promise<JSONContent> {
  const content = node.content
    ? await Promise.all(node.content.map(prepareRotatedImages))
    : undefined;
  if (node.type !== "image" || typeof node.attrs?.src !== "string") {
    return content ? { ...node, content } : node;
  }
  const rotation = ((Number(node.attrs.rotation) % 360) + 360) % 360;
  if (rotation === 0) return content ? { ...node, content } : node;
  const imageSource = node.attrs.src;

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const loadedImage = new Image();
    loadedImage.onerror = () => reject(new Error("Could not rotate an image for PDF export."));
    loadedImage.onload = () => resolve(loadedImage);
    loadedImage.src = imageSource;
  });
  const canvas = document.createElement("canvas");
  const swapsDimensions = rotation === 90 || rotation === 270;
  canvas.width = swapsDimensions ? image.naturalHeight : image.naturalWidth;
  canvas.height = swapsDimensions ? image.naturalWidth : image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image rotation is unavailable for PDF export.");
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(rotation * Math.PI / 180);
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  const sourceType = /^data:image\/(png|jpe?g);/i.exec(imageSource)?.[1];
  const mimeType = sourceType?.toLowerCase().startsWith("jp") ? "image/jpeg" : "image/png";
  return {
    ...node,
    attrs: {
      ...node.attrs,
      src: canvas.toDataURL(mimeType),
      width: swapsDimensions ? node.attrs.height : node.attrs.width,
      height: swapsDimensions ? node.attrs.width : node.attrs.height,
      rotation: 0,
    },
    ...(content ? { content } : {}),
  };
}

export async function generateDocumentMakerPdf(
  pages: DocumentMakerPage[],
  layout: DocumentMakerLayout,
): Promise<Blob> {
  const [{ default: pdfMake }, { default: builtInFonts }, uploadedFonts] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
    getUploadedDocumentFonts(),
  ]);
  const exportPages = await Promise.all(pages.map(async (page) => ({
    ...page,
    content: await prepareRotatedImages(page.content),
  })));
  const vfs = { ...builtInFonts };
  const fonts: Record<string, { normal: string; bold: string; italics: string; bolditalics: string }> = {
    Roboto: {
      normal: "Roboto-Regular.ttf",
      bold: "Roboto-Medium.ttf",
      italics: "Roboto-Italic.ttf",
      bolditalics: "Roboto-MediumItalic.ttf",
    },
  };
  const availableFonts = new Set(["Roboto"]);

  for (const uploaded of uploadedFonts) {
    const bytes = new Uint8Array(uploaded.data);
    if (
      bytes.length < 4 ||
      !(
        (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0) ||
        (bytes[0] === 0x4f && bytes[1] === 0x54 && bytes[2] === 0x54 && bytes[3] === 0x4f)
      )
    ) {
      continue;
    }
    const fileName = `document-font-${availableFonts.size}.ttf`;
    vfs[fileName] = toBase64(bytes);
    fonts[uploaded.family] = {
      normal: fileName,
      bold: fileName,
      italics: fileName,
      bolditalics: fileName,
    };
    availableFonts.add(uploaded.family);
  }

  const dimensions = getDocumentMakerPageDimensions(layout);
  const contentInsets = getDocumentMakerContentInsets(layout);
  const mmToPt = (millimeters: number) => millimeters * 72 / 25.4;
  const pxToMm = (pixels: number) => pixels * 25.4 / 96;
  const content = exportPages.flatMap((page, pageIndex) =>
    (page.content.content ?? []).flatMap((block, blockIndex) => {
      const rendered = blockPdfContent(
        block,
        availableFonts,
        pageIndex > 0 && blockIndex === 0,
      );
      return Array.isArray(rendered) ? rendered : [rendered];
    }),
  );
  const validateImages = (node: JSONContent) => {
    if (node.type === "image") {
      const src = node.attrs?.src;
      if (typeof src !== "string" || !/^data:image\/(?:png|jpe?g);base64,/i.test(src)) {
        throw new TypeError("PDF export supports embedded PNG and JPG images. Reinsert this image and try again.");
      }
    }
    if (node.type === "text" && node.text) {
      const family = (node.marks ?? []).find((mark) => mark.type === "textStyle")
        ?.attrs?.fontFamily;
      if (typeof family === "string" && !availableFonts.has(family.replace(/["']/g, "").trim())) {
        throw new TypeError(`The selected font "${family}" cannot be embedded. Upload its TTF/OTF file before exporting.`);
      }
      if (/[\u0980-\u09ff]/u.test(node.text) &&
        !(typeof family === "string" && availableFonts.has(family.replace(/["']/g, "").trim())) &&
        ![...availableFonts].some((font) => /bengali|bangla/i.test(font))) {
        throw new TypeError("Upload a Bengali/Bangla TTF font before exporting text in that script.");
      }
      if (/[\u0900-\u097f]/u.test(node.text) &&
        !(typeof family === "string" && availableFonts.has(family.replace(/["']/g, "").trim())) &&
        ![...availableFonts].some((font) => /devanagari|hindi/i.test(font))) {
        throw new TypeError("Upload a Devanagari/Hindi TTF font before exporting text in that script.");
      }
    }
    node.content?.forEach(validateImages);
  };
  exportPages.forEach((page) => page.content.content?.forEach(validateImages));
  const documentDefinition = {
    pageSize: {
      width: mmToPt(dimensions.widthMm),
      height: mmToPt(dimensions.heightMm),
    },
    pageMargins: [
      mmToPt(layout.margins.left),
      mmToPt(layout.margins.top + pxToMm(contentInsets.topPx)),
      mmToPt(layout.margins.right),
      mmToPt(layout.margins.bottom + pxToMm(contentInsets.bottomPx)),
    ],
    defaultStyle: { font: "Roboto", fontSize: 12, lineHeight: 1.25 },
    content,
    header: layout.header
      ? { text: layout.header, margin: [mmToPt(layout.margins.left), 8, mmToPt(layout.margins.right), 0], fontSize: 9, color: "#475569" }
      : undefined,
    footer: layout.footer || layout.pageNumbers
      ? (currentPage: number, pageCount: number) => ({
          columns: [
            { text: layout.footer, alignment: "left", width: "*" },
            { text: layout.pageNumbers ? `${currentPage} / ${pageCount}` : "", alignment: "center", width: "auto" },
            { text: "", width: "*" },
          ],
          margin: [mmToPt(layout.margins.left), 0, mmToPt(layout.margins.right), 8],
          fontSize: 9,
          color: "#475569",
        })
      : undefined,
  };

  return new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(documentDefinition, undefined, fonts, vfs).getBlob(resolve);
    } catch (error) {
      reject(error);
    }
  });
}
