import { getSuggestions } from "indic-transliterator";
import type { JSONContent } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Fragment } from "@tiptap/pm/model";

export type DocumentMakerLanguage = "english" | "bengali" | "hindi";
export type DocumentMakerPaperSize = "A4" | "Letter" | "Legal";
export type DocumentMakerOrientation = "portrait" | "landscape";

export interface DocumentMakerLayout {
  paperSize: DocumentMakerPaperSize;
  orientation: DocumentMakerOrientation;
  margins: { top: number; right: number; bottom: number; left: number };
  header: string;
  footer: string;
  pageNumbers: boolean;
}

export const DEFAULT_DOCUMENT_MAKER_LAYOUT: DocumentMakerLayout = {
  paperSize: "A4",
  orientation: "portrait",
  margins: { top: 25, right: 25, bottom: 25, left: 25 },
  header: "",
  footer: "",
  pageNumbers: true,
};

export function getDocumentMakerContentInsets(layout: DocumentMakerLayout) {
  const hasHeader = Boolean(layout.header);
  const hasFooter = Boolean(layout.footer || layout.pageNumbers);
  return {
    topPx: hasHeader ? 22 : 0,
    bottomPx: hasFooter ? 24 : 0,
  };
}

const PAPER_DIMENSIONS_MM: Record<DocumentMakerPaperSize, [number, number]> = {
  A4: [210, 297],
  Letter: [215.9, 279.4],
  Legal: [215.9, 355.6],
};

export function getDocumentMakerPageDimensions(
  layout: Pick<DocumentMakerLayout, "paperSize" | "orientation">,
) {
  const [width, height] = PAPER_DIMENSIONS_MM[layout.paperSize];
  const dimensions =
    layout.orientation === "landscape" ? [height, width] : [width, height];
  return {
    widthMm: dimensions[0],
    heightMm: dimensions[1],
    widthPx: Math.round(dimensions[0] * (96 / 25.4)),
    heightPx: Math.round(dimensions[1] * (96 / 25.4)),
  };
}

export interface DocumentMakerPage {
  id: string;
  content: JSONContent;
}

export function splitDocumentMakerTableAtRow(
  doc: ProseMirrorNode,
  blockIndex: number,
  splitRowIndex: number,
): { currentPage: JSONContent; nextPage: JSONContent } | null {
  const blocks = doc.content.content;
  const table = blocks[blockIndex];
  if (
    !table ||
    table.type.name !== "table" ||
    splitRowIndex <= 0 ||
    splitRowIndex >= table.childCount
  ) {
    return null;
  }

  const rows = table.content.content;
  const continuationRows = rows.slice(splitRowIndex);
  if (rows[0]?.firstChild?.type.name === "tableHeader") {
    continuationRows.unshift(rows[0]);
  }
  const currentTable = table.copy(Fragment.fromArray(rows.slice(0, splitRowIndex)));
  const nextTable = table.copy(Fragment.fromArray(continuationRows));

  return {
    currentPage: {
      type: "doc",
      content: [
        ...blocks.slice(0, blockIndex).map((block) => block.toJSON()),
        currentTable.toJSON(),
      ],
    },
    nextPage: {
      type: "doc",
      content: [
        nextTable.toJSON(),
        ...blocks.slice(blockIndex + 1).map((block) => block.toJSON()),
      ],
    },
  };
}

export function splitDocumentMakerContentAtPageBreak(
  doc: ProseMirrorNode,
): { currentPage: JSONContent; nextPage: JSONContent } | null {
  const blocks = doc.content.content;
  const breakIndex = blocks.findIndex((block) => block.type.name === "pageBreak");
  if (breakIndex < 0) return null;
  const currentPage = blocks.slice(0, breakIndex).map((block) => block.toJSON());
  const nextPage = blocks.slice(breakIndex + 1).map((block) => block.toJSON());
  return {
    currentPage: {
      type: "doc",
      content: currentPage.length ? currentPage : [{ type: "paragraph" }],
    },
    nextPage: {
      type: "doc",
      content: nextPage.length ? nextPage : [{ type: "paragraph" }],
    },
  };
}

export function getDocumentMakerBlockStartPosition(
  doc: ProseMirrorNode,
  blockIndex: number,
): number | null {
  let position: number | null = null;
  doc.forEach((_node, offset, index) => {
    if (index === blockIndex) position = offset;
  });
  return position;
}

export function createDocumentMakerPage(content?: JSONContent): DocumentMakerPage {
  return {
    id: crypto.randomUUID(),
    content: content
      ? structuredClone(content)
      : { type: "doc", content: [{ type: "paragraph" }] },
  };
}

export function duplicateDocumentMakerPage(
  page: DocumentMakerPage,
): DocumentMakerPage {
  return createDocumentMakerPage(page.content);
}

export function insertDocumentMakerPage(
  pages: DocumentMakerPage[],
  index: number,
  page: DocumentMakerPage,
): DocumentMakerPage[] {
  const next = [...pages];
  next.splice(Math.max(0, Math.min(index, next.length)), 0, page);
  return next;
}

export function moveDocumentMakerPage(
  pages: DocumentMakerPage[],
  index: number,
  direction: -1 | 1,
): DocumentMakerPage[] {
  const nextIndex = index + direction;
  if (index < 0 || index >= pages.length || nextIndex < 0 || nextIndex >= pages.length) {
    return pages;
  }

  const next = [...pages];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

export function deleteDocumentMakerPage(
  pages: DocumentMakerPage[],
  index: number,
): DocumentMakerPage[] {
  if (pages.length <= 1 || index < 0 || index >= pages.length) return pages;
  return pages.filter((_, pageIndex) => pageIndex !== index);
}

const SCRIPT_BY_LANGUAGE: Record<Exclude<DocumentMakerLanguage, "english">, string> = {
  bengali: "bengali",
  hindi: "devanagari",
};

export interface ActiveRomanWord {
  word: string;
  from: number;
  to: number;
}

export function getActiveRomanWord(
  text: string,
  cursorOffset: number,
  basePosition = 0,
): ActiveRomanWord | null {
  const words = text.matchAll(/[a-z]+/gi);

  for (const match of words) {
    const word = match[0];
    const start = match.index;
    const end = start + word.length;
    if (cursorOffset < start || cursorOffset > end) continue;

    return {
      word,
      from: basePosition + start,
      to: basePosition + end,
    };
  }

  return null;
}

export function getDocumentMakerSuggestions(
  word: string,
  language: DocumentMakerLanguage,
): string[] {
  if (language === "english" || word.length < 2 || !/^[a-z]+$/i.test(word)) {
    return [];
  }

  return [...new Set(getSuggestions(word, SCRIPT_BY_LANGUAGE[language]))].slice(0, 6);
}
