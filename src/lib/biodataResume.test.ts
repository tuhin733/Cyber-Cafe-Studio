import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  EMPTY_RESUME_DATA,
  RESUME_PURPOSES,
  generateBiodataResumeDocx,
  generateBiodataResumePdf,
  generateBiodataResumeText,
  getDefaultSections,
  getResumeContent,
  type ResumeData,
} from "./biodataResume";

const sampleData: ResumeData = {
  ...EMPTY_RESUME_DATA,
  fullName: "Asha Sen",
  phone: "+91 98765 43210",
  email: "asha@example.com",
  objective: "Seeking a customer service role.",
  education: [{
    qualification: "Higher Secondary",
    institution: "City School",
    board: "State Board",
    year: "2024",
    marks: "85%",
    details: "",
  }],
  experience: [{
    company: "City Store",
    designation: "Sales assistant",
    duration: "2024-2025",
    responsibilities: "Customer support and cashier operations.",
  }],
};

describe("Indian resume and biodata generator", () => {
  it("offers a purpose-specific choice for each supported format", () => {
    expect(RESUME_PURPOSES).toHaveLength(33);
    expect(RESUME_PURPOSES).toContain("Marriage Bio-Data");
    expect(RESUME_PURPOSES).toContain("International / ATS-Friendly Resume");
  });

  it("selects different sections for biodata, government and ATS purposes", () => {
    expect(getDefaultSections("Marriage Bio-Data")).toContain("family");
    expect(getDefaultSections("Central Government Job Application Bio-Data")).toContain("recruitment");
    expect(getDefaultSections("International / ATS-Friendly Resume")).not.toContain("family");
    expect(getDefaultSections("Fresher Resume")).not.toContain("experience");
    expect(getDefaultSections("Simple One-Page Resume")).not.toContain("references");
  });

  it("includes structured qualifications and work experience only when selected", () => {
    const content = getResumeContent("Modern Professional Resume", sampleData, ["education", "experience"]);
    expect(content[0].lines[0]).toContain("Higher Secondary | City School | State Board | 2024 | 85%");
    expect(content[1].lines.join(" ")).toContain("Sales assistant | City Store | 2024-2025");
    expect(getResumeContent("Modern Professional Resume", sampleData, []).length).toBe(0);
  });

  it("preserves the user's selected section order in exported content", () => {
    const sections = getResumeContent(
      "Modern Professional Resume",
      sampleData,
      ["experience", "education"],
    );
    expect(sections.map(({ heading }) => heading)).toEqual([
      "Work experience",
      "Educational qualifications",
    ]);
  });

  it("creates printable multi-page A4 PDFs for Unicode biodata", async () => {
    const blob = await generateBiodataResumePdf(
      "Traditional Indian Bio-Data",
      { ...sampleData, fullName: "প্রিয়া সেন", familyDetails: "Family information" },
      "traditional",
      ["personal", "family", "education"],
    );
    const pdf = await PDFDocument.load(await blob.arrayBuffer());
    expect(blob.type).toBe("application/pdf");
    expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
    expect(pdf.getPageCount()).toBeGreaterThan(0);
  });

  it("exports user-entered Unicode as editable text and DOCX", async () => {
    const data = { ...sampleData, fullName: "প্রিয়া সেন" };
    const text = generateBiodataResumeText("Student Resume", data, ["education"]);
    expect(text).toContain("প্রিয়া সেন");
    expect(text).toContain("Higher Secondary");
    const docx = await generateBiodataResumeDocx("Student Resume", data, ["education"]);
    expect(docx.type).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(docx.size).toBeGreaterThan(0);
  });

  it("omits unselected optional personal and recruitment details", () => {
    const data = { ...sampleData, religion: "Not included", category: "EWS" };
    const text = generateBiodataResumeText("Government Job Resume", data, ["education"]);
    expect(text).not.toContain("Not included");
    expect(text).not.toContain("EWS");
  });
});
