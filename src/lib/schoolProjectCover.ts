export type SchoolProjectCoverStyle = "classic" | "modern" | "nature";

export const SCHOOL_PROJECT_COVER_STYLES: readonly {
  id: SchoolProjectCoverStyle;
  name: string;
  accent: [number, number, number];
  pale: [number, number, number];
}[] = [
  { id: "classic", name: "Classic", accent: [30, 64, 100], pale: [239, 246, 255] },
  { id: "modern", name: "Modern", accent: [15, 118, 110], pale: [240, 253, 250] },
  { id: "nature", name: "Nature", accent: [63, 98, 18], pale: [247, 254, 231] },
];

export interface SchoolProjectCoverData {
  schoolName: string;
  projectTitle: string;
  subject: string;
  studentName: string;
  className: string;
  section: string;
  rollNumber: string;
  teacherName: string;
  academicYear: string;
  submissionDate: string;
}

export async function generateSchoolProjectCoverPdf(
  data: SchoolProjectCoverData,
  style: SchoolProjectCoverStyle,
): Promise<Blob> {
  const selectedStyle = SCHOOL_PROJECT_COVER_STYLES.find(
    ({ id }) => id === style,
  );
  if (!selectedStyle) throw new Error(`Unknown school project cover style: ${style}`);

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const centerX = pageWidth / 2;
  const contentWidth = pageWidth - 48;
  const { accent, pale } = selectedStyle;

  pdf.setFillColor(...pale);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
  pdf.setFillColor(...accent);
  pdf.rect(0, 0, pageWidth, 8, "F");
  pdf.rect(0, pageHeight - 8, pageWidth, 8, "F");
  pdf.setDrawColor(...accent);
  pdf.setLineWidth(0.7);
  pdf.roundedRect(12, 14, pageWidth - 24, pageHeight - 28, 3, 3, "S");
  pdf.setLineWidth(0.25);
  pdf.roundedRect(16, 18, pageWidth - 32, pageHeight - 36, 2, 2, "S");

  let cursorY = 37;
  const drawCentered = (
    text: string,
    fontSize: number,
    color: [number, number, number],
    font: "normal" | "bold",
    maxWidth = contentWidth,
  ) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    pdf.setFont("helvetica", font);
    pdf.setFontSize(fontSize);
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(trimmed, maxWidth);
    const lineHeight = fontSize * 0.48;
    pdf.text(lines, centerX, cursorY, { align: "center", lineHeightFactor: 1.15 });
    cursorY += lines.length * lineHeight;
  };

  drawCentered(data.schoolName || "YOUR SCHOOL NAME", 19, accent, "bold", 160);
  cursorY += 3;
  drawCentered("SCHOOL PROJECT", 11, accent, "bold");
  cursorY += 9;
  drawCentered(data.projectTitle || "PROJECT TITLE", 26, [15, 23, 42], "bold", 155);
  cursorY += 5;

  if (data.subject.trim()) {
    drawCentered(`Subject: ${data.subject}`, 12, [71, 85, 105], "normal");
  }

  const dividerY = Math.max(cursorY + 9, 144);
  pdf.setDrawColor(...accent);
  pdf.setLineWidth(0.7);
  pdf.line(55, dividerY, pageWidth - 55, dividerY);

  cursorY = dividerY + 12;
  drawCentered("SUBMITTED BY", 10, accent, "bold");
  cursorY += 3;
  drawCentered(data.studentName, 17, [15, 23, 42], "bold");

  const studentDetails = [
    data.className.trim() ? `Class: ${data.className.trim()}` : "",
    data.section.trim() ? `Section: ${data.section.trim()}` : "",
    data.rollNumber.trim() ? `Roll No.: ${data.rollNumber.trim()}` : "",
  ].filter(Boolean);
  if (studentDetails.length > 0) {
    cursorY += 2;
    drawCentered(studentDetails.join("     |     "), 10, [71, 85, 105], "normal");
  }

  cursorY = Math.max(cursorY + 8, 205);
  drawCentered("SUBMITTED TO", 10, accent, "bold");
  cursorY += 3;
  drawCentered(data.teacherName || "TEACHER'S NAME", 14, [15, 23, 42], "bold");
  cursorY += 9;
  drawCentered(
    data.academicYear ? `Academic Year: ${data.academicYear}` : "",
    11,
    [71, 85, 105],
    "normal",
  );
  cursorY += 5;
  drawCentered(data.submissionDate, 10, [100, 116, 139], "normal");

  return pdf.output("blob");
}
