import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  BIODATA_RESUME_STYLES,
  formatBiodataDate,
  generateBiodataResumePdf,
  type BiodataResumeData,
} from "./biodataResume";

const sampleData: BiodataResumeData = {
  biodataTitle: "Student Biodata",
  fullName: "Asha Sen",
  phone: "555-0100",
  email: "asha@example.com",
  address: "Dhaka",
  objective: "Seeking a customer service role.",
  education: "Higher Secondary Certificate, 2024",
  experience: "Sales assistant, City Store, 2024-2025",
  skills: "Customer service, cashier operations",
  dateOfBirth: "2002-04-12",
  gender: "Female",
  height: "160 cm",
  religion: "Hindu",
  nationality: "Bangladeshi",
  maritalStatus: "Never married",
  familyDetails: "Father: Teacher; Mother: Homemaker",
  about: "A motivated student interested in science.",
  additionalDetails: "Volunteer at the local library.",
};

describe("biodata and resume PDF", () => {
  it("formats dates in the Indian day/month/year convention", () => {
    expect(formatBiodataDate("2002-04-12")).toBe("12/04/2002");
    expect(formatBiodataDate("12/04/2002")).toBe("12/04/2002");
  });

  it("creates a one-page resume PDF", async () => {
    const blob = await generateBiodataResumePdf(
      "resume",
      sampleData,
      "modern",
    );
    const pdf = await PDFDocument.load(await blob.arrayBuffer());

    expect(blob.type).toBe("application/pdf");
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
  });

  it("creates personal biodata for a custom purpose", async () => {
    const blob = await generateBiodataResumePdf(
      "personal-biodata",
      sampleData,
      "minimalist",
    );
    const pdf = await PDFDocument.load(await blob.arrayBuffer());

    expect(blob.type).toBe("application/pdf");
    expect(pdf.getPageCount()).toBe(1);
  });

  it("adds pages when personal biodata content exceeds one page", async () => {
    const blob = await generateBiodataResumePdf(
      "personal-biodata",
      {
        ...sampleData,
        familyDetails: Array.from(
          { length: 60 },
          (_, index) => `Family detail ${index + 1}`,
        ).join("\n"),
      },
      "classic",
    );
    const pdf = await PDFDocument.load(await blob.arrayBuffer());

    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });

  it("exports both templates in every style", async () => {
    const templates = [
      "resume",
      "personal-biodata",
    ] as const;

    for (const template of templates) {
      for (const { id: style } of BIODATA_RESUME_STYLES) {
        const blob = await generateBiodataResumePdf(template, sampleData, style);
        const pdf = await PDFDocument.load(await blob.arrayBuffer());
        expect(pdf.getPageCount()).toBeGreaterThan(0);
      }
    }
  });
});
