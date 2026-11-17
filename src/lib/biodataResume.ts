import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

export type ResumeStyle = "traditional" | "modern" | "ats";

export const RESUME_STYLES: readonly { id: ResumeStyle; name: string }[] = [
  { id: "traditional", name: "Traditional Indian" },
  { id: "modern", name: "Modern professional" },
  { id: "ats", name: "ATS-friendly" },
];

export const RESUME_PURPOSES = [
  "Traditional Indian Cyber Cafe Resume",
  "Traditional Indian Bio-Data",
  "Modern Professional Resume",
  "Simple One-Page Resume",
  "Two-Page Detailed Resume",
  "Fresher Resume",
  "Experienced Candidate Resume",
  "Private Company Job Resume",
  "Government Job Resume",
  "Central Government Job Application Bio-Data",
  "State Government Job Application Bio-Data",
  "Teaching Job Resume",
  "School Teacher / College Lecturer Resume",
  "Banking Job Resume",
  "Railway Job Resume",
  "Defence Job Bio-Data",
  "Police Job Resume",
  "Engineering Resume",
  "IT / Computer Professional Resume",
  "Medical / Healthcare Resume",
  "Office Assistant / Data Entry Resume",
  "Accountant / Finance Resume",
  "Sales / Marketing Resume",
  "Labour / Worker Resume",
  "Driver / Security Guard Resume",
  "Hotel / Restaurant / Hospitality Resume",
  "Internship Resume",
  "Student Resume",
  "Academic CV",
  "Marriage Bio-Data",
  "Personal Bio-Data",
  "Family Bio-Data",
  "International / ATS-Friendly Resume",
] as const;

export type ResumePurpose = (typeof RESUME_PURPOSES)[number];

export interface EducationEntry {
  qualification: string;
  institution: string;
  board: string;
  year: string;
  marks: string;
  details: string;
}

export interface ExperienceEntry {
  company: string;
  designation: string;
  duration: string;
  responsibilities: string;
}

export interface ResumeData {
  fullName: string;
  photo: string;
  signature: string;
  fatherName: string;
  motherName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  religion: string;
  maritalStatus: string;
  phone: string;
  email: string;
  permanentAddress: string;
  presentAddress: string;
  languages: string;
  hobbies: string;
  objective: string;
  summary: string;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  technicalSkills: string;
  computerKnowledge: string;
  certifications: string;
  training: string;
  projects: string;
  achievements: string;
  awards: string;
  internships: string;
  references: string;
  familyDetails: string;
  category: string;
  pwbdStatus: string;
  domicile: string;
  employmentRegistration: string;
  identificationDetails: string;
  professionalRegistration: string;
  examinationQualifications: string;
  recruitmentDetails: string;
  declaration: string;
  place: string;
  declarationDate: string;
  customSections: { title: string; content: string }[];
}

export const EMPTY_RESUME_DATA: ResumeData = {
  fullName: "",
  photo: "",
  signature: "",
  fatherName: "",
  motherName: "",
  dateOfBirth: "",
  gender: "",
  nationality: "",
  religion: "",
  maritalStatus: "",
  phone: "",
  email: "",
  permanentAddress: "",
  presentAddress: "",
  languages: "",
  hobbies: "",
  objective: "",
  summary: "",
  education: [{ qualification: "", institution: "", board: "", year: "", marks: "", details: "" }],
  experience: [{ company: "", designation: "", duration: "", responsibilities: "" }],
  technicalSkills: "",
  computerKnowledge: "",
  certifications: "",
  training: "",
  projects: "",
  achievements: "",
  awards: "",
  internships: "",
  references: "",
  familyDetails: "",
  category: "",
  pwbdStatus: "",
  domicile: "",
  employmentRegistration: "",
  identificationDetails: "",
  professionalRegistration: "",
  examinationQualifications: "",
  recruitmentDetails: "",
  declaration: "",
  place: "",
  declarationDate: "",
  customSections: [],
};

export type ResumeSectionId =
  | "objective"
  | "summary"
  | "personal"
  | "education"
  | "experience"
  | "skills"
  | "computer"
  | "certifications"
  | "training"
  | "projects"
  | "achievements"
  | "awards"
  | "internships"
  | "family"
  | "recruitment"
  | "references"
  | "languages"
  | "hobbies"
  | "declaration";

export const RESUME_SECTIONS: readonly {
  id: ResumeSectionId;
  title: string;
}[] = [
  { id: "objective", title: "Career objective" },
  { id: "summary", title: "Professional summary" },
  { id: "personal", title: "Personal information" },
  { id: "education", title: "Educational qualifications" },
  { id: "experience", title: "Work experience" },
  { id: "skills", title: "Technical skills" },
  { id: "computer", title: "Computer knowledge" },
  { id: "certifications", title: "Certifications" },
  { id: "training", title: "Training" },
  { id: "projects", title: "Projects" },
  { id: "achievements", title: "Achievements" },
  { id: "awards", title: "Awards" },
  { id: "internships", title: "Internships" },
  { id: "family", title: "Family details" },
  { id: "recruitment", title: "Recruitment details" },
  { id: "references", title: "Professional references" },
  { id: "languages", title: "Languages known" },
  { id: "hobbies", title: "Hobbies and interests" },
  { id: "declaration", title: "Declaration" },
];

const biodataTerms = /bio-data|biodata|marriage|family/i;
const governmentTerms = /government|central|state|railway|defence|police/i;

export function getDefaultSections(purpose: ResumePurpose): ResumeSectionId[] {
  const isBiodata = biodataTerms.test(purpose);
  const government = governmentTerms.test(purpose);
  if (purpose.includes("One-Page")) {
    return ["summary", "objective", "education", "experience", "skills", "certifications", "projects", "languages"];
  }
  if (purpose.includes("Two-Page")) {
    return ["summary", "objective", "personal", "experience", "education", "skills", "computer", "certifications", "training", "projects", "achievements", "awards", "internships", "references"];
  }
  if (/Fresher|Student|Internship/.test(purpose)) {
    return ["objective", "summary", "education", "skills", "computer", "projects", "certifications", "internships", "achievements", "languages"];
  }
  if (purpose.includes("Experienced")) {
    return ["summary", "experience", "education", "skills", "certifications", "projects", "achievements", "references"];
  }
  if (purpose.includes("Academic CV")) {
    return ["summary", "education", "experience", "projects", "training", "certifications", "achievements", "awards", "references", "languages"];
  }
  if (/Teacher|Teaching|Lecturer/.test(purpose)) {
    return ["objective", "summary", "education", "experience", "certifications", "training", "skills", "achievements", "references"];
  }
  const sections: ResumeSectionId[] = isBiodata
    ? ["personal", "family", "education", "experience", "languages", "hobbies", "recruitment", "declaration"]
    : ["objective", "summary", "education", "experience", "skills", "computer", "certifications", "training", "projects", "achievements", "awards", "internships", "references"];
  if (government && !sections.includes("recruitment")) sections.push("recruitment");
  if (purpose.includes("ATS")) {
    return ["summary", "objective", "experience", "education", "skills", "certifications", "projects", "achievements", "languages"];
  }
  if (purpose.includes("Marriage")) {
    return ["personal", "family", "education", "experience", "languages", "hobbies"];
  }
  return sections;
}

export function formatBiodataDate(value: string): string {
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!dateParts) return value;
  return `${dateParts[3]}/${dateParts[2]}/${dateParts[1]}`;
}

function nonEmpty(value: string): boolean {
  return Boolean(value.trim());
}

function educationLines(data: ResumeData): string[] {
  return data.education
    .map((entry) => [
      entry.qualification,
      entry.institution,
      entry.board,
      entry.year,
      entry.marks,
      entry.details,
    ].map((part) => part.trim()).filter(Boolean).join(" | "))
    .filter(Boolean);
}

function experienceLines(data: ResumeData): string[] {
  return data.experience.flatMap((entry) => {
    const heading = [entry.designation, entry.company, entry.duration]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" | ");
    return [heading, entry.responsibilities.trim()].filter(Boolean);
  });
}

export function getResumeContent(
  purpose: ResumePurpose,
  data: ResumeData,
  selectedSections: ResumeSectionId[],
): { heading: string; lines: string[] }[] {
  const sections = new Set(selectedSections);
  const personalDetails: [string, string][] = [
    ["Father's name", data.fatherName],
    ["Mother's name", data.motherName],
    ["Date of birth", formatBiodataDate(data.dateOfBirth)],
    ["Gender", data.gender],
    ["Nationality", data.nationality],
    ["Religion", data.religion],
    ["Marital status", data.maritalStatus],
    ["Mobile", data.phone],
    ["Email", data.email],
    ["Permanent address", data.permanentAddress],
    ["Present address", data.presentAddress],
  ];
  const recruitmentDetails: [string, string][] = [
    ["Category", data.category],
    ["PwBD status", data.pwbdStatus],
    ["Domicile", data.domicile],
    ["Employment registration no.", data.employmentRegistration],
    ["Identification details", data.identificationDetails],
    ["Professional registration", data.professionalRegistration],
    ["Examination qualifications", data.examinationQualifications],
    ["Other recruitment details", data.recruitmentDetails],
  ];
  const content: { id?: ResumeSectionId; heading: string; lines: string[] }[] = [];
  const add = (id: ResumeSectionId, heading: string, lines: string[]) => {
    if (sections.has(id) && lines.some(nonEmpty)) {
      content.push({ id, heading, lines: lines.filter(nonEmpty) });
    }
  };
  add("objective", "Career objective", [data.objective]);
  add("summary", "Professional summary", [data.summary]);
  add("personal", "Personal information", personalDetails
    .filter(([, value]) => nonEmpty(value))
    .map(([label, value]) => `${label}: ${value}`));
  add("education", "Educational qualifications", educationLines(data));
  add("experience", "Work experience", experienceLines(data));
  add("skills", "Technical skills", [data.technicalSkills]);
  add("computer", "Computer knowledge", [data.computerKnowledge]);
  add("certifications", "Certifications", [data.certifications]);
  add("training", "Training", [data.training]);
  add("projects", "Projects", [data.projects]);
  add("achievements", "Achievements", [data.achievements]);
  add("awards", "Awards", [data.awards]);
  add("internships", "Internships", [data.internships]);
  add("family", "Family details", [data.familyDetails]);
  add("recruitment", "Recruitment details", recruitmentDetails
    .filter(([, value]) => nonEmpty(value))
    .map(([label, value]) => `${label}: ${value}`));
  add("references", "Professional references", [data.references]);
  add("languages", "Languages known", [data.languages]);
  add("hobbies", "Hobbies and interests", [data.hobbies]);
  if (sections.has("declaration") && nonEmpty(data.declaration)) {
    content.push({
      id: "declaration",
      heading: "Declaration",
      lines: [data.declaration, [data.place, formatBiodataDate(data.declarationDate)].filter(nonEmpty).join(" | ")].filter(nonEmpty),
    });
  }
  for (const section of data.customSections) {
    if (nonEmpty(section.title) && nonEmpty(section.content)) {
      content.push({ heading: section.title.trim(), lines: [section.content.trim()] });
    }
  }
  content.sort((left, right) => {
    if (!left.id) return right.id ? 1 : 0;
    if (!right.id) return -1;
    return selectedSections.indexOf(left.id) - selectedSections.indexOf(right.id);
  });
  void purpose;
  return content.map(({ heading, lines }) => ({ heading, lines }));
}

export async function generateBiodataResumePdf(
  purpose: ResumePurpose,
  data: ResumeData,
  style: ResumeStyle,
  selectedSections: ResumeSectionId[],
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 17;
  const contentWidth = pageWidth - margin * 2;
  const accent: [number, number, number] = style === "traditional"
    ? [30, 64, 100]
    : style === "modern" ? [15, 118, 110] : [35, 45, 55];
  const resumeContent = getResumeContent(purpose, data, selectedSections);
  let cursorY = 48;

  const header = () => {
    if (style === "modern") {
      pdf.setFillColor(...accent);
      pdf.rect(0, 0, pageWidth, 38, "F");
      pdf.setTextColor(255, 255, 255);
    } else {
      pdf.setTextColor(...accent);
      pdf.setDrawColor(...accent);
      pdf.setLineWidth(style === "traditional" ? 0.7 : 0.3);
      pdf.line(margin, 30, pageWidth - margin, 30);
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    const nameWidth = data.photo ? contentWidth - 25 : contentWidth;
    pdf.text(data.fullName.trim(), margin, 18, { maxWidth: nameWidth });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    const contacts = [data.phone, data.email, data.presentAddress || data.permanentAddress]
      .map((value) => value.trim()).filter(Boolean).join("  |  ");
    if (contacts) {
      pdf.text(pdf.splitTextToSize(contacts, nameWidth), margin, 25);
    }
    if (style !== "ats") {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text(purpose.toUpperCase(), margin, 35, { maxWidth: contentWidth });
    }
    if (data.photo) {
      try {
        pdf.addImage(data.photo, margin + contentWidth - 22, 6, 20, 25, undefined, "FAST");
      } catch {
        throw new Error("The selected photo could not be added to the PDF.");
      }
    }
  };
  const ensureSpace = (height: number) => {
    if (cursorY + height <= pageHeight - margin) return;
    pdf.addPage();
    header();
    cursorY = 45;
  };

  header();
  for (const section of resumeContent) {
    ensureSpace(14);
    pdf.setTextColor(...accent);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(section.heading.toUpperCase(), margin, cursorY);
    cursorY += 3;
    if (style !== "ats") {
      pdf.setDrawColor(...accent);
      pdf.setLineWidth(style === "traditional" ? 0.45 : 0.25);
      pdf.line(margin, cursorY, pageWidth - margin, cursorY);
    }
    cursorY += 5;
    pdf.setTextColor(45, 55, 65);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    for (const line of section.lines) {
      for (const wrapped of pdf.splitTextToSize(line, contentWidth)) {
        ensureSpace(5);
        pdf.text(wrapped, margin, cursorY);
        cursorY += 4.5;
      }
      cursorY += 1;
    }
    cursorY += 3;
  }
  if (data.signature) {
    ensureSpace(22);
    try {
      pdf.addImage(data.signature, pageWidth - margin - 34, cursorY, 34, 12, undefined, "FAST");
    } catch {
      throw new Error("The selected signature could not be added to the PDF.");
    }
    cursorY += 14;
  }
  return pdf.output("blob");
}

export function generateBiodataResumeText(
  purpose: ResumePurpose,
  data: ResumeData,
  selectedSections: ResumeSectionId[],
): string {
  const lines = [data.fullName.trim(), purpose, ""];
  const contacts = [data.phone, data.email, data.presentAddress || data.permanentAddress]
    .map((value) => value.trim()).filter(Boolean);
  if (contacts.length) lines.push(contacts.join(" | "), "");
  for (const section of getResumeContent(purpose, data, selectedSections)) {
    lines.push(section.heading.toUpperCase(), ...section.lines, "");
  }
  return lines.join("\r\n").trimEnd() + "\r\n";
}

export async function generateBiodataResumeDocx(
  purpose: ResumePurpose,
  data: ResumeData,
  selectedSections: ResumeSectionId[],
): Promise<Blob> {
  const imageRun = (source: string, width: number, height: number) => {
    const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(source);
    if (!match) return null;
    const binary = atob(match[2]);
    return new ImageRun({
      type: match[1].toLowerCase().startsWith("jp") ? "jpg" : "png",
      data: Uint8Array.from(binary, (character) => character.charCodeAt(0)),
      transformation: { width, height },
    });
  };
  const paragraphs = [
    new Paragraph({
      text: data.fullName.trim(),
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: purpose, italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
    }),
  ];
  const photo = imageRun(data.photo, 72, 90);
  if (photo) paragraphs.unshift(new Paragraph({ children: [photo], alignment: AlignmentType.RIGHT }));
  const contacts = [data.phone, data.email, data.presentAddress || data.permanentAddress]
    .map((value) => value.trim()).filter(Boolean);
  if (contacts.length) {
    paragraphs.push(new Paragraph({ text: contacts.join(" | "), alignment: AlignmentType.CENTER }));
  }
  for (const section of getResumeContent(purpose, data, selectedSections)) {
    paragraphs.push(new Paragraph({
      text: section.heading,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 220, after: 80 },
    }));
    for (const line of section.lines) {
      paragraphs.push(new Paragraph({ text: line, spacing: { after: 60 } }));
    }
  }
  const signature = imageRun(data.signature, 100, 36);
  if (signature) paragraphs.push(new Paragraph({ children: [signature], alignment: AlignmentType.RIGHT }));
  return Packer.toBlob(new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 850, right: 850, bottom: 850, left: 850 },
        },
      },
      children: paragraphs,
    }],
  }));
}
