import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  cropPdfFile,
  mergePdfFiles,
  organizePdfFile,
  parsePageOrder,
  parsePageRanges,
  protectPdfFile,
  rotatePdfFile,
  splitPdfFile,
  unlockPdfFile,
} from "./pdfTools";

async function createPdfFile(name: string, pageSizes: [number, number][]): Promise<File> {
  const pdf = await PDFDocument.create();
  pageSizes.forEach((size) => pdf.addPage(size));
  return new File([await pdf.save()], name, { type: "application/pdf" });
}

describe("PDF page selection", () => {
  it("parses separate ranges and single pages", () => {
    expect(parsePageRanges("1-2, 4", 4)).toEqual([[1, 2], [4]]);
  });

  it("rejects malformed, duplicate, and out-of-range pages", () => {
    expect(() => parsePageRanges("1-2, 2-3", 4)).toThrow(/duplicate/);
    expect(() => parsePageRanges("0, 2", 4)).toThrow(/between 1 and 4/);
    expect(() => parsePageRanges("3-1", 4)).toThrow(/between 1 and 4/);
  });

  it("requires a complete page order without duplicates", () => {
    expect(parsePageOrder("3, 1, 2", 3)).toEqual([3, 1, 2]);
    expect(() => parsePageOrder("1, 1, 2", 3)).toThrow(/exactly once/);
    expect(() => parsePageOrder("1, 2", 3)).toThrow(/exactly once/);
  });
});

describe("PDF page operations", () => {
  it("merges, splits, and reorders PDF pages", async () => {
    const first = await createPdfFile("first.pdf", [[100, 200], [200, 300]]);
    const second = await createPdfFile("second.pdf", [[300, 400]]);
    const merged = await mergePdfFiles([first, second]);
    expect((await PDFDocument.load(merged)).getPageCount()).toBe(3);

    const parts = await splitPdfFile(first, [[1], [2]]);
    expect(parts.map((part) => part.filename)).toEqual([
      "first-part-1.pdf",
      "first-part-2.pdf",
    ]);

    const ordered = await organizePdfFile(first, [2, 1]);
    const orderedPdf = await PDFDocument.load(ordered);
    expect(orderedPdf.getPages().map((page) => page.getWidth())).toEqual([200, 100]);
  });

  it("rotates and crops all pages", async () => {
    const file = await createPdfFile("sample.pdf", [[200, 300]]);
    const rotated = await PDFDocument.load(await rotatePdfFile(file, 90));
    expect(rotated.getPage(0).getRotation().angle).toBe(90);

    const cropped = await PDFDocument.load(await cropPdfFile(file, 10));
    expect(cropped.getPage(0).getCropBox()).toMatchObject({
      x: 20,
      y: 30,
      width: 160,
      height: 240,
    });
  });

  it("protects a PDF with AES-256 and unlocks it with the password", async () => {
    const file = await createPdfFile("sample.pdf", [[200, 300]]);
    const protectedBytes = await protectPdfFile(file, "safe-password");
    const protectedFile = new File([protectedBytes], "protected.pdf", {
      type: "application/pdf",
    });
    const unlocked = await unlockPdfFile(protectedFile, "safe-password");
    expect(unlocked.flattened).toBe(false);
    expect((await PDFDocument.load(unlocked.bytes)).getPageCount()).toBe(1);
    await expect(unlockPdfFile(protectedFile, "wrong-password")).rejects.toThrow();
  });
});
