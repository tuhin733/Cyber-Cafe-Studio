import { describe, expect, it } from "vitest";
import { PDFArray, PDFDocument, PDFName, PDFStream } from "pdf-lib";
import {
  addPdfWatermark,
  cropPdfFile,
  deletePdfPages,
  mergePdfFiles,
  organizePdfFile,
  parsePageOrder,
  parsePageRanges,
  protectPdfFile,
  removeFlattenedWatermarkRegion,
  removePdfWatermarks,
  rotatePdfFile,
  splitPdfFile,
  unlockPdfFile,
} from "./pdfTools";

async function createPdfFile(name: string, pageSizes: [number, number][]): Promise<File> {
  const pdf = await PDFDocument.create();
  pageSizes.forEach((size) => pdf.addPage(size));
  return new File([await pdf.save()], name, { type: "application/pdf" });
}

function countAppWatermarks(pdf: PDFDocument): number {
  return pdf.getPages().reduce((count, page) => {
    const contents = page.node.Contents();
    if (!(contents instanceof PDFArray)) return count;
    return count + Array.from({ length: contents.size() }, (_, index) => {
      const stream = pdf.context.lookupMaybe(contents.get(index), PDFStream);
      return stream?.dict.has(PDFName.of("CyberCafeStudioWatermark")) ? 1 : 0;
    }).reduce<number>((total, current) => total + current, 0);
  }, 0);
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
  it("deletes selected pages while preserving the remaining pages", async () => {
    const file = await createPdfFile("sample.pdf", [[100, 200], [200, 300], [300, 400]]);
    const deleted = await PDFDocument.load(await deletePdfPages(file, [1, 3]));
    expect(deleted.getPageCount()).toBe(1);
    expect(deleted.getPage(0).getWidth()).toBe(200);
    await expect(deletePdfPages(file, [1, 2, 3])).rejects.toThrow(/at least one page must remain/i);
    await expect(deletePdfPages(file, [4])).rejects.toThrow(/between 1 and 3/i);
  });

  it("adds a removable Cyber Cafe Studio watermark", async () => {
    const file = await createPdfFile("sample.pdf", [[200, 300], [300, 400]]);
    const watermarkedBytes = await addPdfWatermark(file, {
      type: "text",
      text: "COPY",
      opacity: 0.2,
      position: "diagonal",
      size: 55,
      rotation: 0,
      color: "#595959",
      pages: [2],
    });
    const watermarkedFile = new File([watermarkedBytes], "watermarked.pdf", {
      type: "application/pdf",
    });
    const watermarkedPdf = await PDFDocument.load(watermarkedBytes);
    expect(countAppWatermarks(watermarkedPdf)).toBe(1);
    const removedBytes = await removePdfWatermarks(watermarkedFile);
    const removed = await PDFDocument.load(removedBytes);
    expect(removed.getPageCount()).toBe(2);
    await expect(removePdfWatermarks(file)).rejects.toThrow(/no removable watermark/i);
    await expect(addPdfWatermark(file, {
      type: "text",
      text: " ",
      opacity: 0.2,
      position: "diagonal",
      size: 55,
      rotation: 0,
      color: "#595959",
    })).rejects.toThrow(/enter text/i);
  });

  it("removes PDF Watermark annotations from other applications", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([200, 300]);
    const annotation = pdf.context.obj({
      Type: "Annot",
      Subtype: "Watermark",
      Rect: [10, 10, 100, 40],
    });
    page.node.addAnnot(pdf.context.register(annotation));
    const file = new File([await pdf.save()], "annotated.pdf", {
      type: "application/pdf",
    });
    const cleaned = await PDFDocument.load(await removePdfWatermarks(file));
    expect(cleaned.getPage(0).node.Annots()?.size() ?? 0).toBe(0);
  });

  it("rejects invalid flattened watermark selections before rasterizing", async () => {
    const file = await createPdfFile("sample.pdf", [[200, 300]]);
    await expect(removeFlattenedWatermarkRegion(file, {
      region: { x: 0.9, y: 0.9, width: 0.2, height: 0.2 },
      fillColor: "#ffffff",
    })).rejects.toThrow(/valid watermark area/i);
  });

  it("adds a positioned and rotated PNG logo watermark", async () => {
    const file = await createPdfFile("sample.pdf", [[200, 300]]);
    const png = Uint8Array.from(
      atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lWQAAAAASUVORK5CYII="),
      (character) => character.charCodeAt(0),
    );
    const logo = new File([png], "logo.png", { type: "image/png" });
    const watermarked = await addPdfWatermark(file, {
      type: "image",
      text: "",
      image: logo,
      opacity: 0.5,
      position: "top-right",
      size: 30,
      rotation: 15,
      color: "#000000",
    });
    expect(countAppWatermarks(await PDFDocument.load(watermarked))).toBe(1);
  });

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
