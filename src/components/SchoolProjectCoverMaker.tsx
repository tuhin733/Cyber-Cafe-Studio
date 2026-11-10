import { useState } from "react";
import { ArrowDownToLine, GraduationCap } from "lucide-react";
import BackToToolsButton from "./BackToToolsButton";
import {
  SCHOOL_PROJECT_COVER_STYLES,
  generateSchoolProjectCoverPdf,
  type SchoolProjectCoverData,
  type SchoolProjectCoverStyle,
} from "../lib/schoolProjectCover";
import { savePDF } from "../lib/pdf";
import { notifyUserError } from "../lib/userErrors";
import { notifyUserSuccess } from "../lib/userNotifications";

interface Props {
  onClose: () => void;
}

const initialData: SchoolProjectCoverData = {
  schoolName: "",
  projectTitle: "",
  subject: "",
  studentName: "",
  className: "",
  section: "",
  rollNumber: "",
  teacherName: "",
  academicYear: "",
  submissionDate: "",
};

const fields: {
  key: keyof SchoolProjectCoverData;
  label: string;
  placeholder: string;
  maxLength: number;
}[] = [
  { key: "schoolName", label: "School name", placeholder: "e.g. Green Valley School", maxLength: 80 },
  { key: "projectTitle", label: "Project title", placeholder: "e.g. The Water Cycle", maxLength: 100 },
  { key: "subject", label: "Subject", placeholder: "e.g. Environmental Science", maxLength: 80 },
  { key: "studentName", label: "Student name", placeholder: "Your full name", maxLength: 80 },
  { key: "className", label: "Class / Grade", placeholder: "e.g. 8", maxLength: 24 },
  { key: "section", label: "Section", placeholder: "e.g. A", maxLength: 24 },
  { key: "rollNumber", label: "Roll number", placeholder: "e.g. 12", maxLength: 24 },
  { key: "teacherName", label: "Teacher name", placeholder: "e.g. Ms. Das", maxLength: 80 },
  { key: "academicYear", label: "Academic year", placeholder: "e.g. 2025–2026", maxLength: 40 },
  { key: "submissionDate", label: "Submission date", placeholder: "e.g. 10 November 2026", maxLength: 40 },
];

const fieldClassName =
  "mt-1.5 w-full rounded-xl border border-ui bg-surface px-3.5 py-2.5 text-sm text-ink-primary outline-none transition placeholder:text-ink-faint focus:border-action-emphasis focus:ring-4 focus:ring-action-subtle";

function CoverPreview({
  data,
  style,
}: {
  data: SchoolProjectCoverData;
  style: SchoolProjectCoverStyle;
}) {
  const selectedStyle = SCHOOL_PROJECT_COVER_STYLES.find(({ id }) => id === style);
  if (!selectedStyle) throw new Error(`Unknown school project cover style: ${style}`);

  return (
    <div className="mx-auto w-full max-w-[500px] bg-surface p-3 shadow-xl sm:p-5">
      <div
        className="aspect-[210/297] p-[5%]"
        style={{ backgroundColor: `rgb(${selectedStyle.pale.join(" ")})` }}
      >
        <div
          className="flex h-full flex-col items-center border-2 px-[7%] py-[8%] text-center"
          style={{ borderColor: `rgb(${selectedStyle.accent.join(" ")})` }}
        >
          <div
            className="w-full border-b-2 pb-[5%]"
            style={{ borderColor: `rgb(${selectedStyle.accent.join(" ")})` }}
          >
            <GraduationCap
              className="mx-auto h-8 w-8 sm:h-10 sm:w-10"
              style={{ color: `rgb(${selectedStyle.accent.join(" ")})` }}
              aria-hidden="true"
            />
            <p className="mt-2 break-words text-base font-bold uppercase tracking-wide text-ink-primary sm:text-xl">
              {data.schoolName || "Your School Name"}
            </p>
            <p
              className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] sm:text-xs"
              style={{ color: `rgb(${selectedStyle.accent.join(" ")})` }}
            >
              School Project
            </p>
          </div>

          <div className="my-auto w-full py-4">
            <p className="break-words text-xl font-bold leading-tight text-ink-primary sm:text-3xl">
              {data.projectTitle || "Project Title"}
            </p>
            {data.subject && (
              <p className="mt-3 break-words text-xs text-ink-secondary sm:text-sm">
                Subject: {data.subject}
              </p>
            )}
          </div>

          <div className="w-full border-t border-ui pt-[6%]">
            <p
              className="text-[9px] font-bold uppercase tracking-[0.18em] sm:text-[11px]"
              style={{ color: `rgb(${selectedStyle.accent.join(" ")})` }}
            >
              Submitted by
            </p>
            <p className="mt-1 break-words text-sm font-bold text-ink-primary sm:text-lg">
              {data.studentName || "Student Name"}
            </p>
            <p className="mt-1 break-words text-[10px] leading-relaxed text-ink-secondary sm:text-xs">
              {[
                data.className && `Class: ${data.className}`,
                data.section && `Section: ${data.section}`,
                data.rollNumber && `Roll No.: ${data.rollNumber}`,
              ].filter(Boolean).join("  |  ") || "Class  |  Section  |  Roll number"}
            </p>

            <p
              className="mt-4 text-[9px] font-bold uppercase tracking-[0.18em] sm:text-[11px]"
              style={{ color: `rgb(${selectedStyle.accent.join(" ")})` }}
            >
              Submitted to
            </p>
            <p className="mt-1 break-words text-xs font-semibold text-ink-primary sm:text-sm">
              {data.teacherName || "Teacher Name"}
            </p>
            {data.academicYear && (
              <p className="mt-2 text-[10px] text-ink-secondary sm:text-xs">
                Academic Year: {data.academicYear}
              </p>
            )}
            {data.submissionDate && (
              <p className="mt-1 text-[10px] text-ink-muted sm:text-xs">
                {data.submissionDate}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SchoolProjectCoverMaker({ onClose }: Props) {
  const [data, setData] = useState(initialData);
  const [style, setStyle] = useState<SchoolProjectCoverStyle>("classic");
  const [isExporting, setIsExporting] = useState(false);

  const updateField = (key: keyof SchoolProjectCoverData, value: string) => {
    setData((current) => ({ ...current, [key]: value }));
  };

  const exportPdf = async () => {
    if (!data.projectTitle.trim() || !data.studentName.trim()) {
      notifyUserError("Enter a project title and student name before creating the cover.");
      return;
    }

    setIsExporting(true);
    try {
      const pdf = await generateSchoolProjectCoverPdf(data, style);
      const safeName = data.projectTitle
        .trim()
        .replace(/[<>:"/\\|?*]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 80) || "school-project";
      const saved = await savePDF(pdf, `${safeName}-cover.pdf`);
      if (saved) notifyUserSuccess("School project cover created successfully.");
    } catch (error) {
      console.error("Could not create the school project cover PDF:", error);
      notifyUserError("Couldn't create the cover PDF. Check the entered details and try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto bg-surface-muted">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-7 sm:py-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackToToolsButton onClick={onClose} toolName="School Project Cover Maker" />
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={isExporting}
            className="inline-flex items-center gap-2 rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-ink-inverse shadow-sm transition hover:bg-action-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-emphasis disabled:cursor-wait disabled:opacity-60"
          >
            <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
            {isExporting ? "Creating PDF…" : "Create PDF"}
          </button>
        </div>

        <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
          <section className="rounded-2xl border border-ui bg-surface p-4 shadow-sm sm:p-6" aria-label="Cover details">
            <h1 className="text-lg font-bold text-ink-primary">Cover details</h1>
            <p className="mt-1 text-sm leading-6 text-ink-secondary">
              Fill in the project information. The cover updates as you type.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {fields.map(({ key, label, placeholder, maxLength }) => (
                <label key={key} className="block text-sm font-medium text-ink-secondary">
                  {label}
                  <input
                    value={data[key]}
                    onChange={(event) => updateField(key, event.target.value)}
                    placeholder={placeholder}
                    maxLength={maxLength}
                    className={fieldClassName}
                  />
                </label>
              ))}
            </div>

            <fieldset className="mt-6">
              <legend className="text-sm font-semibold text-ink-secondary">Cover style</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {SCHOOL_PROJECT_COVER_STYLES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setStyle(option.id)}
                    aria-pressed={style === option.id}
                    className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action ${
                      style === option.id
                        ? "border-action-border-strong bg-action-subtle text-action"
                        : "border-ui bg-surface text-ink-secondary hover:border-ui-strong"
                    }`}
                  >
                    {option.name}
                  </button>
                ))}
              </div>
            </fieldset>
          </section>

          <section className="lg:sticky lg:top-5" aria-label="Cover preview">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-secondary">A4 cover preview</h2>
              <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-ink-muted">
                Portrait
              </span>
            </div>
            <CoverPreview data={data} style={style} />
          </section>
        </div>
      </div>
    </main>
  );
}
