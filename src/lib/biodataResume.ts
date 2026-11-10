export type BiodataResumeTemplate =
  | "resume"
  | "personal-biodata";

export type BiodataResumeStyle = "classic" | "minimalist" | "modern";

export const BIODATA_RESUME_STYLES: readonly {
  id: BiodataResumeStyle;
  name: string;
}[] = [
  { id: "classic", name: "Classic" },
  { id: "minimalist", name: "Minimalist" },
  { id: "modern", name: "Modern" },
];

interface TemplateDetails {
  id: BiodataResumeTemplate;
  name: string;
  description: string;
  title: string;
  kind: "resume" | "biodata";
}

export const BIODATA_RESUME_TEMPLATES: readonly TemplateDetails[] = [
  {
    id: "resume",
    name: "Resume",
    description: "Flexible format for students, freshers, and experienced applicants",
    title: "",
    kind: "resume",
  },
  {
    id: "personal-biodata",
    name: "Personal Biodata",
    description: "Flexible format for personal or official use",
    title: "PERSONAL BIODATA",
    kind: "biodata",
  },
];

export interface BiodataResumeData {
  biodataTitle: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  objective: string;
  education: string;
  experience: string;
  skills: string;
  dateOfBirth: string;
  gender: string;
  height: string;
  religion: string;
  nationality: string;
  maritalStatus: string;
  familyDetails: string;
  about: string;
  additionalDetails: string;
}

export function formatBiodataDate(value: string): string {
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!dateParts) return value;
  return `${dateParts[3]}/${dateParts[2]}/${dateParts[1]}`;
}

export async function generateBiodataResumePdf(
  templateId: BiodataResumeTemplate,
  data: BiodataResumeData,
  style: BiodataResumeStyle,
): Promise<Blob> {
  const template = BIODATA_RESUME_TEMPLATES.find(({ id }) => id === templateId);
  if (!template) throw new Error(`Unknown biodata or resume template: ${templateId}`);

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const accent: [number, number, number] =
    style === "modern"
      ? [15, 118, 110]
      : style === "classic"
        ? [30, 64, 100]
        : [100, 116, 139];
  const title =
    template.kind === "resume"
      ? template.title
      : data.biodataTitle.trim() || template.title;
  let cursorY = 58;

  const addPageHeader = () => {
    pdf.setDrawColor(...accent);
    pdf.setFillColor(...accent);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    if (style === "modern") {
      pdf.rect(0, 0, pageWidth, 43, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(23);
      pdf.text(data.fullName.trim(), margin, 20, { maxWidth: contentWidth });
    } else if (style === "classic") {
      if (template.kind === "biodata") {
        pdf.setTextColor(...accent);
        pdf.text(title, margin, 12);
      }
      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(22);
      pdf.text(data.fullName.trim(), margin, 24, { maxWidth: contentWidth });
      pdf.setLineWidth(0.8);
      pdf.line(margin, 29, pageWidth - margin, 29);
    } else {
      if (template.kind === "biodata") {
        pdf.setTextColor(...accent);
        pdf.setFontSize(10);
        pdf.text(title, margin, 13);
      }
      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(20);
      pdf.text(data.fullName.trim(), margin, 24, { maxWidth: contentWidth });
      pdf.setLineWidth(0.3);
      pdf.line(margin, 29, pageWidth - margin, 29);
    }

    const contact = [data.phone, data.email, data.address]
      .map((value) => value.trim())
      .filter(Boolean)
      .join("  |  ");
    const contactColor: [number, number, number] =
      style === "modern" ? [255, 255, 255] : [71, 85, 105];
    pdf.setTextColor(...contactColor);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    if (contact) {
      const contactLines = pdf.splitTextToSize(contact, contentWidth);
      pdf.text(
        contactLines,
        margin,
        37,
      );
    }
  };

  const ensureSpace = (height: number) => {
    if (cursorY + height <= pageHeight - margin) return;
    pdf.addPage();
    addPageHeader();
    cursorY = 55;
  };

  const addSection = (heading: string, value: string) => {
    const lines = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    ensureSpace(14);
    pdf.setTextColor(...accent);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(heading.toUpperCase(), margin, cursorY);
    cursorY += 3;
    if (style !== "minimalist") {
      pdf.setDrawColor(...accent);
      pdf.setLineWidth(style === "modern" ? 0.35 : 0.55);
      pdf.line(margin, cursorY, pageWidth - margin, cursorY);
    }
    cursorY += 6;

    pdf.setTextColor(51, 65, 85);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    for (const line of lines) {
      const wrapped = pdf.splitTextToSize(line, contentWidth);
      for (const wrappedLine of wrapped) {
        ensureSpace(6);
        pdf.text(wrappedLine, margin, cursorY);
        cursorY += 5;
      }
      cursorY += 1;
    }
    cursorY += 3;
  };

  addPageHeader();

  if (template.kind === "resume") {
    addSection("Career objective", data.objective);
    addSection("Experience", data.experience);
    addSection("Education", data.education);
    addSection("Skills", data.skills);
  } else {
    const personalDetails = [
      ["Date of birth", formatBiodataDate(data.dateOfBirth)],
      ["Gender", data.gender],
      ["Height", data.height],
      ["Religion", data.religion],
      ["Nationality", data.nationality],
      ["Marital status", data.maritalStatus],
    ].filter(([, value]) => value.trim());

    if (personalDetails.length > 0) {
      ensureSpace(personalDetails.length * 8 + 14);
      pdf.setTextColor(...accent);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text("PERSONAL DETAILS", margin, cursorY);
      cursorY += 3;
      if (style !== "minimalist") {
        pdf.setDrawColor(...accent);
        pdf.setLineWidth(0.35);
        pdf.line(margin, cursorY, pageWidth - margin, cursorY);
      }
      cursorY += 7;

      for (const [label, value] of personalDetails) {
        pdf.setTextColor(100, 116, 139);
        pdf.setFont("helvetica", "normal");
        pdf.text(label, margin, cursorY);
        pdf.setTextColor(51, 65, 85);
        pdf.setFont("helvetica", "bold");
        pdf.text(value, margin + 43, cursorY, {
          maxWidth: contentWidth - 43,
        });
        cursorY += 7;
      }
      cursorY += 3;
    }

    addSection("About", data.about);
    addSection("Education", data.education);
    addSection("Work and experience", data.experience);
    addSection("Skills and interests", data.skills);
    addSection("Family and background", data.familyDetails);
    addSection("Additional details", data.additionalDetails);
  }

  return pdf.output("blob");
}
