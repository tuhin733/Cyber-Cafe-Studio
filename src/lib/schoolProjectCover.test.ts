import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  SCHOOL_PROJECT_COVER_STYLES,
  generateSchoolProjectCoverPdf,
  type SchoolProjectCoverData,
} from "./schoolProjectCover";

const sampleData: SchoolProjectCoverData = {
  schoolName: "Green Valley School",
  projectTitle: "The Water Cycle",
  subject: "Environmental Science",
  studentName: "Asha Sen",
  className: "8",
  section: "A",
  rollNumber: "12",
  teacherName: "Ms. Das",
  academicYear: "2025–2026",
  submissionDate: "10 November 2026",
};

describe("school project cover PDF", () => {
  it("creates a single-page A4 cover", async () => {
    const blob = await generateSchoolProjectCoverPdf(sampleData, "modern");
    const pdf = await PDFDocument.load(await blob.arrayBuffer());

    expect(blob.type).toBe("application/pdf");
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
    expect(pdf.getPage(0).getHeight()).toBeCloseTo(841.89, 1);
  });

  it("exports each cover style", async () => {
    for (const { id } of SCHOOL_PROJECT_COVER_STYLES) {
      const blob = await generateSchoolProjectCoverPdf(sampleData, id);
      const pdf = await PDFDocument.load(await blob.arrayBuffer());
      expect(pdf.getPageCount()).toBe(1);
    }
  });

  it("rejects unknown styles rather than producing a misleading cover", async () => {
    await expect(
      generateSchoolProjectCoverPdf(sampleData, "unknown" as never),
    ).rejects.toThrow("Unknown school project cover style");
  });
});
