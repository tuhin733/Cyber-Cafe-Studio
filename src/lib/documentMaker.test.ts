import { generateHTML, generateText, getSchema } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";
import {
  createDocumentMakerPage,
  DEFAULT_DOCUMENT_MAKER_LAYOUT,
  deleteDocumentMakerPage,
  duplicateDocumentMakerPage,
  getActiveRomanWord,
  getDocumentMakerBlockStartPosition,
  getDocumentMakerPageDimensions,
  getDocumentMakerSuggestions,
  insertDocumentMakerPage,
  moveDocumentMakerPage,
  removeLegacyDocumentShapes,
  splitDocumentMakerContentAtPageBreak,
  splitDocumentMakerTableAtRow,
} from "./documentMaker";
import { DOCUMENT_MAKER_EXTENSIONS } from "./documentMakerExtensions";
import { exportDocumentMakerDocx, importDocumentMakerDocx } from "./documentMakerDocx";
import {
  createDocumentMakerPreviewHtml,
  generateDocumentMakerPdf,
} from "./documentMakerPdf";
import * as documentMakerFonts from "./documentMakerFonts";
import {
  getDocumentMakerFontFamily,
  getInstalledDocumentFontFamilies,
} from "./documentMakerFonts";

describe("document maker typing helpers", () => {
  it("finds the roman word around a cursor within a text block", () => {
    expect(getActiveRomanWord("hello amar friend", 10, 4)).toEqual({
      word: "amar",
      from: 10,
      to: 14,
    });
  });

  it("removes legacy shapes while preserving text-box content", () => {
    const normalized = removeLegacyDocumentShapes({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Before" }] },
        { type: "documentShape", attrs: { shapeType: "rectangle" } },
        { type: "documentShape", attrs: { shapeType: "textBox", text: "Editable note" } },
        {
          type: "blockquote",
          content: [{
            type: "documentShape",
            attrs: { shapeType: "textBox", text: "Nested note" },
          }],
        },
      ],
    });

    expect(
      generateText(normalized, DOCUMENT_MAKER_EXTENSIONS).replace(/\s+/g, " ").trim(),
    ).toBe("Before Editable note Nested note");
  });

  it("does not offer transliteration candidates in English mode", () => {
    expect(getDocumentMakerSuggestions("amar", "english")).toEqual([]);
  });

  it("offers a Bangla candidate for the example phonetic input", () => {
    expect(getDocumentMakerSuggestions("amar", "bengali")).toContain("আমার");
  });

  it("offers Hindi suggestions for phonetic input", () => {
    expect(getDocumentMakerSuggestions("namaste", "hindi").length).toBeGreaterThan(0);
  });

  it("adds, duplicates, reorders, and deletes document pages", () => {
    const first = createDocumentMakerPage({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "First" }] }],
    });
    const blank = createDocumentMakerPage();
    const duplicated = duplicateDocumentMakerPage(first);
    const pages = insertDocumentMakerPage([first, blank], 1, duplicated);

    expect(duplicated.id).not.toBe(first.id);
    expect(duplicated.content).toEqual(first.content);
    expect(moveDocumentMakerPage(pages, 2, -1).map((page) => page.id)).toEqual([
      first.id,
      blank.id,
      duplicated.id,
    ]);
    expect(deleteDocumentMakerPage(pages, 1).map((page) => page.id)).toEqual([
      first.id,
      blank.id,
    ]);
  });

  it("keeps at least one editable page", () => {
    const page = createDocumentMakerPage();
    expect(deleteDocumentMakerPage([page], 0)).toEqual([page]);
  });

  it("keeps an overflowing atomic block when moving it to the next page", () => {
    const doc = getSchema(DOCUMENT_MAKER_EXTENSIONS).nodeFromJSON({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "First page" }] },
        { type: "image", attrs: { src: "data:image/png;base64,AA==" } },
        { type: "paragraph", content: [{ type: "text", text: "After image" }] },
      ],
    });
    const splitPosition = getDocumentMakerBlockStartPosition(doc, 1);

    expect(splitPosition).not.toBeNull();
    if (splitPosition === null) throw new Error("The overflowing block was not found.");
    const nextPage = doc.slice(splitPosition, doc.content.size).content;
    expect(nextPage.childCount).toBe(2);
    expect(nextPage.child(0).type.name).toBe("image");
    expect(nextPage.child(0).attrs.src).toBe("data:image/png;base64,AA==");
    expect(nextPage.child(1).textContent).toBe("After image");
  });

  it("uses the chosen paper dimensions and orientation", () => {
    expect(DEFAULT_DOCUMENT_MAKER_LAYOUT.pageNumbers).toBe(false);
    expect(getDocumentMakerPageDimensions(DEFAULT_DOCUMENT_MAKER_LAYOUT)).toMatchObject({
      widthMm: 210,
      heightMm: 297,
    });
    expect(getDocumentMakerPageDimensions({
      ...DEFAULT_DOCUMENT_MAKER_LAYOUT,
      paperSize: "Letter",
      orientation: "landscape",
    })).toMatchObject({ widthMm: 279.4, heightMm: 215.9 });
  });

  it("splits content at an explicit page break without losing either side", () => {
    const doc = getSchema(DOCUMENT_MAKER_EXTENSIONS).nodeFromJSON({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Before" }] },
        { type: "pageBreak" },
        { type: "paragraph", content: [{ type: "text", text: "After" }] },
      ],
    });
    expect(splitDocumentMakerContentAtPageBreak(doc)).toMatchObject({
      currentPage: { content: [{ content: [{ text: "Before" }] }] },
      nextPage: { content: [{ content: [{ text: "After" }] }] },
    });
  });

  it("repeats table headers when a table continues on the next page", () => {
    const doc = getSchema(DOCUMENT_MAKER_EXTENSIONS).nodeFromJSON({
      type: "doc",
      content: [{
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [{ type: "tableHeader", content: [{ type: "paragraph" }] }],
          },
          {
            type: "tableRow",
            content: [{ type: "tableCell", content: [{ type: "paragraph" }] }],
          },
          {
            type: "tableRow",
            content: [{ type: "tableCell", content: [{ type: "paragraph" }] }],
          },
        ],
      }],
    });
    const split = splitDocumentMakerTableAtRow(doc, 0, 2);
    expect(split?.currentPage.content?.[0].content).toHaveLength(2);
    expect(split?.nextPage.content?.[0].content).toHaveLength(2);
    expect(split?.nextPage.content?.[0].content?.[0].content?.[0].type).toBe("tableHeader");
  });

  it("matches the page preview to the selected layout and repeated page numbers", () => {
    const html = createDocumentMakerPreviewHtml(
      [
        createDocumentMakerPage({
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Preview content" }] }],
        }),
        createDocumentMakerPage(),
      ],
      {
        ...DEFAULT_DOCUMENT_MAKER_LAYOUT,
        orientation: "landscape",
        header: "Company name",
        footer: "Confidential",
        pageNumbers: true,
      },
    );
    expect(html).toContain("@page { size:297mm 210mm");
    expect(html).toContain("document-maker-preview-page-shell");
    expect(html).toContain("overflow:auto");
    expect(html).toContain("transform-origin:top center");
    expect(html).toContain("align-items:center");
    expect(html).toContain("Company name");
    expect(html).toContain("Confidential");
    expect(html).toContain("1 / 2");
    expect(html).toContain("2 / 2");
  });

  it("renders font size, image, and table content for exports", () => {
    const html = generateHTML(
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Large text",
                marks: [
                  {
                    type: "textStyle",
                    attrs: { fontSize: "24px", fontFamily: "Noto Serif Bengali" },
                  },
                ],
              },
            ],
          },
          {
            type: "image",
            attrs: {
              src: "data:image/png;base64,AA==",
              alt: "test image",
              align: "center",
              rotation: 90,
              width: 180,
              height: 90,
              x: 120,
              y: 80,
            },
          },
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                attrs: { rowHeight: 40 },
                content: [
                  {
                    type: "tableHeader",
                    content: [{ type: "paragraph", content: [{ type: "text", text: "Cell" }] }],
                  },
                ],
              },
            ],
          },
        ],
      },
      DOCUMENT_MAKER_EXTENSIONS,
    );

    expect(html).toContain('font-size: 24px');
    expect(html).toContain('font-family: &quot;Noto Serif Bengali&quot;');
    expect(html).toContain('alt="test image"');
    expect(html).toContain('data-align="center"');
    expect(html).toContain('data-rotation="90"');
    expect(html).toContain('data-position-x="120"');
    expect(html).toContain('data-position-y="80"');
    expect(html).toContain("left: 120px");
    expect(html).toContain("top: 80px");
    expect(html).toContain("<table");
    expect(html).toContain('data-row-height="40"');
    expect(html).toContain("<th>");
    expect(html).not.toContain("document-maker-shape");
  });

  it("derives a safe font family name from an uploaded font filename", () => {
    expect(getDocumentMakerFontFamily("Noto_Serif-Bengali.ttf")).toBe(
      "Noto_Serif-Bengali",
    );
    expect(getDocumentMakerFontFamily("!!!.woff2")).toBe("");
  });

  it("exports and imports a DOCX document with its text", async () => {
    const original = createDocumentMakerPage({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "A Word document" }] },
        { type: "paragraph", content: [{ type: "text", text: "Round-trip paragraph." }] },
        {
          type: "image",
          attrs: {
            src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==",
            width: 48,
            height: 48,
            x: 120,
            y: 180,
          },
        },
      ],
    });
    const blob = await exportDocumentMakerDocx(
      [original],
      DEFAULT_DOCUMENT_MAKER_LAYOUT,
      "Round trip",
    );
    const file = new File([await blob.arrayBuffer()], "round-trip.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const imported = await importDocumentMakerDocx(file);
    const importedText = imported
      .map((page) => generateText(page.content, DOCUMENT_MAKER_EXTENSIONS))
      .join("\n");
    expect(blob.size).toBeGreaterThan(100);
    expect(importedText).toContain("A Word document");
    expect(importedText).toContain("Round-trip paragraph.");
  });

  it("generates PDFs with list items", async () => {
    const getUploadedFonts = vi
      .spyOn(documentMakerFonts, "getUploadedDocumentFonts")
      .mockResolvedValue([]);
    try {
      const page = createDocumentMakerPage({
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [{
              type: "listItem",
              content: [{
                type: "paragraph",
                content: [{ type: "text", text: "First list item" }],
              }],
            }],
          },
        ],
      });

      const pdf = await generateDocumentMakerPdf([page], DEFAULT_DOCUMENT_MAKER_LAYOUT);

      expect(pdf.type).toBe("application/pdf");
      expect(pdf.size).toBeGreaterThan(100);
    } finally {
      getUploadedFonts.mockRestore();
    }
  }, 20000);

  it("uses the Electron installed-font API and explains when its preload is outdated", async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, "desktopAPI");
    const getInstalledFonts = vi.fn().mockResolvedValue(["Arial", "Calibri"]);
    Object.defineProperty(window, "desktopAPI", {
      configurable: true,
      value: { getInstalledFonts },
    });

    try {
      await expect(getInstalledDocumentFontFamilies()).resolves.toEqual([
        "Arial",
        "Calibri",
      ]);
      expect(getInstalledFonts).toHaveBeenCalledOnce();

      Object.defineProperty(window, "desktopAPI", {
        configurable: true,
        value: {},
      });
      await expect(getInstalledDocumentFontFamilies()).rejects.toThrow(
        "Restart Cyber Cafe Studio",
      );
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(window, "desktopAPI", originalDescriptor);
      } else {
        delete (window as Window & { desktopAPI?: unknown }).desktopAPI;
      }
    }
  });
});
