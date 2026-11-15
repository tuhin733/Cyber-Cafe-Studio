import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT } from "../constants";
import type { UploadedDoc } from "../types";
import {
  getPrintPageNumbers,
  MAX_DOCUMENT_PRINT_PAGES,
  prepareDocumentPrintPages,
} from "./documentPrint";

const createDoc = (id: string): UploadedDoc => ({
  id,
  fileName: `${id}.png`,
  file: new File(["image"], `${id}.png`, { type: "image/png" }),
  url: `blob:${id}`,
  pxW: 100,
  pxH: 100,
  category: "aadhar",
  label: id,
  fitToPage: true,
  widthMm: 190,
  heightMm: 277,
});

describe("document printing", () => {
  it("selects all, odd, and even pages", () => {
    expect(getPrintPageNumbers("all", 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPrintPageNumbers("odd", 5)).toEqual([1, 3, 5]);
    expect(getPrintPageNumbers("even", 5)).toEqual([2, 4]);
  });

  it("parses, sorts, and deduplicates custom page ranges", () => {
    expect(getPrintPageNumbers("custom", 6, "5, 1, 3-4, 4")).toEqual([
      1, 3, 4, 5,
    ]);
  });

  it("rejects invalid or out-of-range custom pages", () => {
    expect(getPrintPageNumbers("custom", 5, "1, 6")).toEqual([]);
    expect(getPrintPageNumbers("custom", 5, "3-2")).toEqual([]);
    expect(getPrintPageNumbers("custom", 5, "1,,2")).toEqual([]);
    expect(getPrintPageNumbers("custom", 5, "")).toEqual([]);
  });

  it("prepares only the requested pages for printing", async () => {
    const docs = [
      createDoc("first"),
      { ...createDoc("second"), pageBreakBefore: 1 },
    ];
    const pages = await prepareDocumentPrintPages(
      docs,
      DEFAULT_LAYOUT,
      0,
      [2],
    );

    expect(pages).toHaveLength(1);
    expect(pages[0].images).toHaveLength(1);
  });

  it("prepares positioned pages without altering image colors", async () => {
    const doc = createDoc("front");
    const [page] = await prepareDocumentPrintPages([doc], DEFAULT_LAYOUT, 0);

    expect(page.images).toHaveLength(1);
    expect(page.images[0]).toMatchObject({
      dataUrl: "data:image/png;base64,aW1hZ2U=",
      x: expect.any(Number),
      y: expect.any(Number),
      width: expect.any(Number),
      height: expect.any(Number),
    });
  });

  it("preserves requested blank pages", async () => {
    const pages = await prepareDocumentPrintPages(
      [],
      DEFAULT_LAYOUT,
      2,
    );

    expect(pages).toEqual([{ images: [] }, { images: [] }]);
  });

  it("rejects jobs with more than the supported page limit", async () => {
    await expect(
      prepareDocumentPrintPages(
        [],
        DEFAULT_LAYOUT,
        MAX_DOCUMENT_PRINT_PAGES + 1,
      ),
    ).rejects.toThrow(`1 to ${MAX_DOCUMENT_PRINT_PAGES} pages`);
  });

  it("rejects image types that the print pipeline cannot safely embed", async () => {
    const doc = { ...createDoc("animated"), file: new File(["image"], "animated.gif", { type: "image/gif" }) };

    await expect(
      prepareDocumentPrintPages([doc], DEFAULT_LAYOUT, 0),
    ).rejects.toThrow("supports JPG, PNG, and WebP");
  });
});
