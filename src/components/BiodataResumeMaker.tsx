import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowDown,
  ArrowUp,
  BriefcaseBusiness,
  FileText,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import BackToToolsButton from "./BackToToolsButton";
import Dropdown from "./Dropdown";
import InputField from "./InputField";
import type { HTMLInputTypeAttribute } from "react";
import {
  EMPTY_RESUME_DATA,
  RESUME_PURPOSES,
  RESUME_SECTIONS,
  RESUME_STYLES,
  formatBiodataDate,
  generateBiodataResumeDocx,
  generateBiodataResumePdf,
  generateBiodataResumeText,
  getDefaultSections,
  getResumeContent,
  type EducationEntry,
  type ExperienceEntry,
  type ResumeData,
  type ResumePurpose,
  type ResumeSectionId,
  type ResumeStyle,
} from "../lib/biodataResume";
import { downloadBlob, savePDF } from "../lib/pdf";
import { notifyUserError } from "../lib/userErrors";
import { notifyUserSuccess } from "../lib/userNotifications";
import { useToolAutoSave } from "../hooks/useToolAutoSave";
import AutoSaveStatusReporter from "./AutoSaveStatusReporter";

interface Props {
  onClose: () => void;
}

interface ResumeSession {
  version: 2;
  purpose: ResumePurpose;
  style: ResumeStyle;
  sections: ResumeSectionId[];
  data: ResumeData;
}

const workflowSteps = [
  { title: "Contact", description: "Name and contact details" },
  { title: "Personal", description: "Optional personal information" },
  { title: "Education", description: "Qualifications and results" },
  { title: "Experience", description: "Work history and internships" },
  { title: "Skills", description: "Skills, projects and awards" },
  { title: "More details", description: "Government, family and custom" },
  { title: "Sections", description: "Choose and arrange content" },
] as const;

const examplePlaceholders: Record<string, string> = {
  "Full name *": "e.g. Priya Sharma",
  "Mobile number": "e.g. +91 98765 43210",
  "Email address": "e.g. priya@example.com",
  "Present address": "e.g. 12 Park Street, Kolkata, West Bengal",
  "Permanent address": "e.g. Village, District, State, PIN code",
  "Career objective": "e.g. Seeking an entry-level role where I can apply my communication and computer skills.",
  "Professional summary": "e.g. Detail-oriented graduate with experience in customer service and MS Office.",
  "Father's name": "e.g. Rajesh Sharma",
  "Mother's name": "e.g. Sunita Sharma",
  "Date of birth": "e.g. 15/08/2000",
  Gender: "e.g. Female",
  Nationality: "e.g. Indian",
  Religion: "e.g. Hindu (optional)",
  "Marital status": "e.g. Single",
  "Languages known": "e.g. Bengali, Hindi, English",
  "Hobbies and interests": "e.g. Reading, volunteering, cricket",
  Qualification: "e.g. Class 10 / B.A. / ITI",
  Institution: "e.g. North City College",
  "Board / University": "e.g. West Bengal State University",
  "Passing year": "e.g. 2023",
  "Marks / percentage / CGPA": "e.g. 82% or 8.4 CGPA",
  "Relevant details": "e.g. First division; relevant subjects",
  "Company / employer": "e.g. ABC Services Pvt. Ltd.",
  "Job designation": "e.g. Office Assistant",
  "Employment duration": "e.g. Jan 2022 – Mar 2024",
  "Job responsibilities": "e.g. Managed customer queries and maintained daily records.",
  "Technical skills": "e.g. MS Excel, Tally, customer service",
  "Computer knowledge": "e.g. MS Office, email, internet",
  Certifications: "e.g. Tally Prime certificate, First Aid",
  Training: "e.g. Three-month data entry training",
  Projects: "e.g. Built a student attendance tracker using Excel",
  Achievements: "e.g. Led a team project that improved filing time",
  Awards: "e.g. Best Volunteer Award, 2024",
  Internships: "e.g. Data Entry Intern, ABC Services, Jun–Aug 2024",
  "Professional references": "e.g. Name, designation, organization, contact (with permission)",
  "PwBD status": "e.g. Add status/details only if required by the notification",
  Domicile: "e.g. West Bengal",
  "Employment registration number": "e.g. Employment Exchange registration number",
  "Relevant identification details": "e.g. ID type and number, only if requested",
  "Professional registration": "e.g. Nursing Council registration number",
  "Examination qualifications": "e.g. Exam name, year, roll number, result",
  "Other recruitment-specific details": "e.g. Details explicitly requested in the notification",
  "Family details": "e.g. Parent/guardian name and occupation (if required)",
  "Declaration text": "e.g. I declare that the information provided is true to the best of my knowledge.",
  Place: "e.g. Kolkata",
  Date: "e.g. 17/11/2024",
  "Section heading": "e.g. Volunteer work",
  Details: "e.g. Organization, role, dates, and relevant details",
};

function Field({
  label,
  value,
  onChange,
  multiline = false,
  placeholder,
  type = "text",
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  type?: HTMLInputTypeAttribute;
  optional?: boolean;
}) {
  const fieldPlaceholder = placeholder ?? examplePlaceholders[label] ?? "e.g. Add relevant details";

  return (
    <label className="block text-sm font-medium text-ink-secondary">
      {label}
      {optional && <span className="ml-1 text-xs font-normal text-ink-muted">Optional</span>}
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={fieldPlaceholder}
          rows={4}
          className="mt-1.5 min-h-28 w-full resize-y rounded-xl border border-ui bg-surface px-3.5 py-3 text-sm leading-6 text-ink-strong outline-none transition placeholder:text-ink-faint focus:border-action-accent focus:ring-2 focus:ring-action-soft"
        />
      ) : (
        <InputField
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={fieldPlaceholder}
          className="mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm text-ink-primary"
        />
      )}
    </label>
  );
}

function SectionPanel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bento-panel p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-sm font-bold text-ink-primary">
        {icon}
        {title}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function makeSafeName(name: string): string {
  return Array.from(name.trim().replace(/[<>:"/\\|?*]/g, ""))
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "resume";
}

function hasValue(value: string): boolean {
  return Boolean(value.trim());
}

function readImageFile(file: File): Promise<string> {
  if (!["image/png", "image/jpeg"].includes(file.type)) {
    return Promise.reject(new Error("Choose a PNG or JPEG image."));
  }
  if (file.size > 5 * 1024 * 1024) {
    return Promise.reject(new Error("Choose an image smaller than 5 MB."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result)
      : reject(new Error("The image could not be read."));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
}

export default function BiodataResumeMaker({ onClose }: Props) {
  const [purpose, setPurpose] = useState<ResumePurpose>("Traditional Indian Cyber Cafe Resume");
  const [style, setStyle] = useState<ResumeStyle>("traditional");
  const [sections, setSections] = useState<ResumeSectionId[]>(() =>
    getDefaultSections("Traditional Indian Cyber Cafe Resume"),
  );
  const [data, setData] = useState<ResumeData>(EMPTY_RESUME_DATA);
  const [isExporting, setIsExporting] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const restoreSession = useCallback(async (saved: ResumeSession | Record<string, unknown>) => {
    const raw = saved as Record<string, unknown>;
    if (raw.version === 1 && raw.data && typeof raw.data === "object") {
      const old = raw.data as Record<string, unknown>;
      const oldText = (key: string) => typeof old[key] === "string" ? old[key] as string : "";
      const oldTemplate = raw.templateId === "personal-biodata" ? "personal" : "resume";
      const restoredPurpose: ResumePurpose = oldTemplate === "personal"
        ? "Personal Bio-Data"
        : "Traditional Indian Cyber Cafe Resume";
      const oldStyle = raw.templateStyles && typeof raw.templateStyles === "object"
        ? (raw.templateStyles as Record<string, unknown>)[raw.templateId as string]
        : undefined;
      const migratedStyle: ResumeStyle = oldStyle === "modern"
        ? "modern"
        : oldStyle === "classic" ? "traditional" : "ats";
      const educationText = oldText("education");
      const experienceText = oldText("experience");
      setPurpose(restoredPurpose);
      setStyle(migratedStyle);
      setSections(getDefaultSections(restoredPurpose));
      setData({
        ...EMPTY_RESUME_DATA,
        fullName: oldText("fullName"),
        phone: oldText("phone"),
        email: oldText("email"),
        permanentAddress: oldText("address"),
        objective: oldText("objective"),
        dateOfBirth: oldText("dateOfBirth"),
        gender: oldText("gender"),
        religion: oldText("religion"),
        nationality: oldText("nationality"),
        maritalStatus: oldText("maritalStatus"),
        familyDetails: oldText("familyDetails"),
        technicalSkills: oldText("skills"),
        summary: oldText("about"),
        recruitmentDetails: oldText("additionalDetails"),
        education: educationText ? [{
          qualification: "",
          institution: "",
          board: "",
          year: "",
          marks: "",
          details: educationText,
        }] : EMPTY_RESUME_DATA.education,
        experience: experienceText ? [{
          company: "",
          designation: "",
          duration: "",
          responsibilities: experienceText,
        }] : EMPTY_RESUME_DATA.experience,
      });
      return;
    }
    const session = saved as ResumeSession;
    const validPurposes = RESUME_PURPOSES as readonly string[];
    const validStyles = RESUME_STYLES.map(({ id }) => id);
    if (
      session.version !== 2 ||
      !validPurposes.includes(session.purpose) ||
      !validStyles.includes(session.style) ||
      !Array.isArray(session.sections) ||
      !session.data ||
      typeof session.data.fullName !== "string" ||
      !Array.isArray(session.data.education) ||
      !Array.isArray(session.data.experience)
    ) {
      throw new Error("The saved resume and biodata session is invalid.");
    }
    setPurpose(session.purpose);
    setStyle(session.style);
    setSections(session.sections.filter((section) =>
      RESUME_SECTIONS.some(({ id }) => id === section),
    ));
    setData({ ...EMPTY_RESUME_DATA, ...session.data });
  }, []);

  const autosaveSnapshot = useMemo<ResumeSession>(() => ({
    version: 2,
    purpose,
    style,
    sections,
    data,
  }), [data, purpose, sections, style]);
  const autoSave = useToolAutoSave(
    "biodata-resume-maker",
    autosaveSnapshot,
    restoreSession,
    !isExporting,
  );

  const updateField = <K extends keyof ResumeData>(field: K, value: ResumeData[K]) => {
    setData((current) => ({ ...current, [field]: value }));
  };
  const updateEntry = <T extends EducationEntry | ExperienceEntry>(
    key: "education" | "experience",
    index: number,
    field: keyof T,
    value: string,
  ) => {
    setData((current) => ({
      ...current,
      [key]: current[key].map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry,
      ),
    }));
  };
  const reorderSection = (index: number, offset: -1 | 1) => {
    setSections((current) => {
      const next = [...current];
      const target = index + offset;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };
  const selectImage = async (field: "photo" | "signature", file?: File) => {
    if (!file) return;
    try {
      updateField(field, await readImageFile(file));
    } catch (error) {
      notifyUserError(error instanceof Error ? error.message : "The image could not be loaded.");
    }
  };

  const exportDocument = async (format: "pdf" | "docx" | "txt") => {
    if (!data.fullName.trim()) {
      notifyUserError("Enter the applicant's name before exporting.");
      return;
    }
    setIsExporting(true);
    try {
      const filename = `${makeSafeName(data.fullName)}-${format === "txt" ? "resume" : purpose.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${format}`;
      if (format === "pdf") {
        const pdf = await generateBiodataResumePdf(purpose, data, style, sections);
        if (await savePDF(pdf, filename)) notifyUserSuccess("PDF created successfully.");
      } else if (format === "docx") {
        downloadBlob(await generateBiodataResumeDocx(purpose, data, sections), filename);
        notifyUserSuccess("Word document downloaded.");
      } else {
        downloadBlob(new Blob([generateBiodataResumeText(purpose, data, sections)], {
          type: "text/plain;charset=utf-8",
        }), filename);
        notifyUserSuccess("Editable text downloaded.");
      }
    } catch (error) {
      console.error(`Could not export the resume or biodata as ${format}:`, error);
      notifyUserError(`Couldn't create the ${format.toUpperCase()} file. Check the entered details and try again.`);
    } finally {
      setIsExporting(false);
    }
  };

  const shortcutsRef = useRef({ exportDocument, isExporting });
  shortcutsRef.current = { exportDocument, isExporting };
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.repeat || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      if (!shortcutsRef.current.isExporting) void shortcutsRef.current.exportDocument("pdf");
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const previewContent = getResumeContent(purpose, data, sections);
  const hasPreview = Boolean(data.fullName || previewContent.length);

  return (
    <main className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto bg-surface-muted">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-4 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <BackToToolsButton onClick={onClose} toolName="Biodata & Resume Maker" />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <AutoSaveStatusReporter
              status={autoSave.status}
              lastSavedAt={autoSave.lastSavedAt}
              onRetry={autoSave.retry}
            />
            <button
              type="button"
              onClick={() => void exportDocument("pdf")}
              disabled={isExporting}
              className="inline-flex items-center gap-2 rounded-xl bg-action px-4 py-2.5 text-sm font-semibold text-ink-inverse shadow-sm transition hover:bg-action-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-emphasis disabled:cursor-wait disabled:opacity-60"
              data-tooltip="Create PDF (Ctrl/Cmd+S)"
            >
              <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
              {isExporting ? "Creating…" : "Export PDF"}
            </button>
            <button type="button" disabled={isExporting} onClick={() => void exportDocument("docx")} className="rounded-xl border border-ui bg-surface px-3 py-2.5 text-sm font-semibold text-ink-secondary hover:bg-surface-subtle disabled:opacity-50">Word</button>
          </div>
        </div>

        <section className="bento-panel mt-5 grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_260px] sm:items-end sm:p-5" aria-label="Document purpose and design">
          <label className="block text-sm font-semibold text-ink-secondary">
            Document purpose
            <Dropdown
              value={purpose}
              aria-label="Document purpose"
              onChange={(value) => {
                const next = value as ResumePurpose;
                setPurpose(next);
                setSections(getDefaultSections(next));
                setActiveStep(0);
                if (next.includes("ATS")) setStyle("ats");
              }}
              options={RESUME_PURPOSES.map((item) => ({ value: item, label: item }))}
              className="!mt-1.5 !min-h-0 !w-full !rounded-xl !px-3.5 !py-2.5 text-sm"
            />
          </label>
          <label className="block text-sm font-semibold text-ink-secondary">
            Layout style
            <Dropdown
              value={style}
              aria-label="Layout style"
              onChange={(value) => {
                if (RESUME_STYLES.some(({ id }) => id === value)) setStyle(value as ResumeStyle);
              }}
              options={RESUME_STYLES.map(({ id, name }) => ({ value: id, label: name }))}
              className="!mt-1.5 !min-h-0 !w-full !rounded-xl !px-3.5 !py-2.5 text-sm"
            />
          </label>
          <p className="text-xs leading-5 text-ink-muted sm:col-span-2">
            Add only details needed for your application. Word and text exports preserve regional scripts.
          </p>
        </section>

        <nav aria-label="Resume creation steps" className="mt-4 overflow-x-auto rounded-2xl border border-ui bg-surface p-2 shadow-sm">
          <ol className="flex min-w-[690px] items-center gap-1">
            {workflowSteps.map((step, index) => {
              const isCurrent = activeStep === index;
              return (
                <li key={step.title} className="flex min-w-0 flex-1 items-center">
                  <button
                    type="button"
                    onClick={() => setActiveStep(index)}
                    aria-current={isCurrent ? "step" : undefined}
                    className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition sm:px-3 ${
                      isCurrent ? "bg-action-subtle text-action" : "text-ink-muted hover:bg-surface-subtle hover:text-ink-primary"
                    }`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isCurrent ? "bg-action text-ink-inverse" : "bg-surface-muted text-ink-muted"
                    }`}>{index + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold">{step.title}</span>
                      <span className="hidden truncate text-[10px] opacity-75 xl:block">{step.description}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.78fr)]">
          <div className="grid min-w-0 gap-4">
            {activeStep === 0 && (
              <>
            <SectionPanel title="Personal and contact information" icon={<UserRound className="h-4 w-4 text-action" aria-hidden="true" />}>
              <Field label="Full name *" value={data.fullName} onChange={(value) => updateField("fullName", value)} placeholder="e.g. Priya Sharma" />
              <label className="block text-sm font-medium text-ink-secondary">Photograph <span className="ml-1 text-xs font-normal text-ink-muted">Optional · PNG/JPEG, max 5 MB</span>
                <InputField type="file" accept="image/png,image/jpeg" onChange={(event) => void selectImage("photo", event.target.files?.[0])} className="mt-1.5 w-full rounded-xl file:mr-3 file:rounded-md file:border-0 file:bg-action-subtle file:px-2 file:py-1 file:text-xs" />
                {data.photo && <button type="button" onClick={() => updateField("photo", "")} className="mt-1 text-xs font-medium text-danger">Remove photograph</button>}
              </label>
              <Field label="Mobile number" value={data.phone} onChange={(value) => updateField("phone", value)} placeholder="e.g. +91 98765 43210" type="tel" optional />
              <Field label="Email address" value={data.email} onChange={(value) => updateField("email", value)} placeholder="e.g. priya@example.com" type="email" optional />
              <Field label="Present address" value={data.presentAddress} onChange={(value) => updateField("presentAddress", value)} multiline optional />
              <Field label="Permanent address" value={data.permanentAddress} onChange={(value) => updateField("permanentAddress", value)} multiline optional />
            </SectionPanel>

            <SectionPanel title="Profile" icon={<BriefcaseBusiness className="h-4 w-4 text-action" aria-hidden="true" />}>
              <Field label="Career objective" value={data.objective} onChange={(value) => updateField("objective", value)} multiline optional />
              <Field label="Professional summary" value={data.summary} onChange={(value) => updateField("summary", value)} multiline optional />
            </SectionPanel>
              </>
            )}

            {activeStep === 1 && (
            <SectionPanel title="Personal details" icon={<UserRound className="h-4 w-4 text-action" aria-hidden="true" />}>
              <Field label="Father's name" value={data.fatherName} onChange={(value) => updateField("fatherName", value)} optional />
              <Field label="Mother's name" value={data.motherName} onChange={(value) => updateField("motherName", value)} optional />
              <Field label="Date of birth" value={data.dateOfBirth} onChange={(value) => updateField("dateOfBirth", value)} type="date" optional />
              <Field label="Gender" value={data.gender} onChange={(value) => updateField("gender", value)} optional />
              <Field label="Nationality" value={data.nationality} onChange={(value) => updateField("nationality", value)} optional />
              <Field label="Religion" value={data.religion} onChange={(value) => updateField("religion", value)} optional />
              <Field label="Marital status" value={data.maritalStatus} onChange={(value) => updateField("maritalStatus", value)} optional />
              <Field label="Languages known" value={data.languages} onChange={(value) => updateField("languages", value)} multiline placeholder="e.g. Bengali, Hindi, English" optional />
              <Field label="Hobbies and interests" value={data.hobbies} onChange={(value) => updateField("hobbies", value)} multiline optional />
            </SectionPanel>
            )}

            {activeStep === 2 && (
            <SectionPanel title="Educational qualifications" icon={<FileText className="h-4 w-4 text-action" aria-hidden="true" />}>
              <p className="text-xs leading-5 text-ink-muted sm:col-span-2">Add Class 10/Madhyamik, Class 12, ITI, Diploma, Graduation, Post-Graduation, PhD, or other qualifications as needed.</p>
              {data.education.map((entry, index) => (
                <div key={index} className="grid gap-3 rounded-xl border border-ui-subtle p-3 sm:col-span-2 sm:grid-cols-2">
                  <div className="flex items-center justify-between sm:col-span-2">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">Qualification {index + 1}</h3>
                    <button type="button" aria-label={`Remove qualification ${index + 1}`} onClick={() => updateField("education", data.education.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-subtle hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <Field label="Qualification" value={entry.qualification} onChange={(value) => updateEntry<EducationEntry>("education", index, "qualification", value)} placeholder="e.g. Class 10 / B.A. / ITI" />
                  <Field label="Institution" value={entry.institution} onChange={(value) => updateEntry<EducationEntry>("education", index, "institution", value)} />
                  <Field label="Board / University" value={entry.board} onChange={(value) => updateEntry<EducationEntry>("education", index, "board", value)} />
                  <Field label="Passing year" value={entry.year} onChange={(value) => updateEntry<EducationEntry>("education", index, "year", value)} />
                  <Field label="Marks / percentage / CGPA" value={entry.marks} onChange={(value) => updateEntry<EducationEntry>("education", index, "marks", value)} />
                  <Field label="Relevant details" value={entry.details} onChange={(value) => updateEntry<EducationEntry>("education", index, "details", value)} />
                </div>
              ))}
              <button type="button" onClick={() => updateField("education", [...data.education, { qualification: "", institution: "", board: "", year: "", marks: "", details: "" }])} className="inline-flex items-center gap-2 justify-self-start rounded-lg border border-ui px-3 py-2 text-xs font-semibold text-ink-secondary hover:bg-surface-subtle"><Plus className="h-4 w-4" />Add qualification</button>
            </SectionPanel>
            )}

            {activeStep === 3 && (
            <SectionPanel title="Work experience" icon={<BriefcaseBusiness className="h-4 w-4 text-action" aria-hidden="true" />}>
              {data.experience.map((entry, index) => (
                <div key={index} className="grid gap-3 rounded-xl border border-ui-subtle p-3 sm:col-span-2 sm:grid-cols-2">
                  <div className="flex items-center justify-between sm:col-span-2">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">Experience {index + 1}</h3>
                    <button type="button" aria-label={`Remove experience ${index + 1}`} onClick={() => updateField("experience", data.experience.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-subtle hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <Field label="Company / employer" value={entry.company} onChange={(value) => updateEntry<ExperienceEntry>("experience", index, "company", value)} />
                  <Field label="Job designation" value={entry.designation} onChange={(value) => updateEntry<ExperienceEntry>("experience", index, "designation", value)} />
                  <Field label="Employment duration" value={entry.duration} onChange={(value) => updateEntry<ExperienceEntry>("experience", index, "duration", value)} placeholder="e.g. Jan 2022 – Mar 2024" />
                  <Field label="Job responsibilities" value={entry.responsibilities} onChange={(value) => updateEntry<ExperienceEntry>("experience", index, "responsibilities", value)} multiline />
                </div>
              ))}
              <button type="button" onClick={() => updateField("experience", [...data.experience, { company: "", designation: "", duration: "", responsibilities: "" }])} className="inline-flex items-center gap-2 justify-self-start rounded-lg border border-ui px-3 py-2 text-xs font-semibold text-ink-secondary hover:bg-surface-subtle"><Plus className="h-4 w-4" />Add experience</button>
            </SectionPanel>
            )}

            {activeStep === 4 && (
            <SectionPanel title="Skills and professional details">
              <Field label="Technical skills" value={data.technicalSkills} onChange={(value) => updateField("technicalSkills", value)} multiline optional />
              <Field label="Computer knowledge" value={data.computerKnowledge} onChange={(value) => updateField("computerKnowledge", value)} multiline optional />
              <Field label="Certifications" value={data.certifications} onChange={(value) => updateField("certifications", value)} multiline optional />
              <Field label="Training" value={data.training} onChange={(value) => updateField("training", value)} multiline optional />
              <Field label="Projects" value={data.projects} onChange={(value) => updateField("projects", value)} multiline optional />
              <Field label="Achievements" value={data.achievements} onChange={(value) => updateField("achievements", value)} multiline optional />
              <Field label="Awards" value={data.awards} onChange={(value) => updateField("awards", value)} multiline optional />
              <Field label="Internships" value={data.internships} onChange={(value) => updateField("internships", value)} multiline optional />
              <Field label="Professional references" value={data.references} onChange={(value) => updateField("references", value)} multiline optional />
            </SectionPanel>
            )}

            {activeStep === 5 && (
              <>
            <SectionPanel title="Government recruitment details">
              <p className="text-xs leading-5 text-ink-muted sm:col-span-2">These details vary by notification. Leave blank unless they are relevant and specifically requested.</p>
              <label className="block text-sm font-medium text-ink-secondary">Category (optional)
                <Dropdown
                  value={data.category}
                  aria-label="Category"
                  onChange={(value) => updateField("category", value)}
                  options={[
                    { value: "", label: "Not provided" },
                    ...["General", "SC", "ST", "OBC", "EWS", "Other"].map((item) => ({ value: item, label: item })),
                  ]}
                  className="!mt-1.5 !min-h-0 !w-full !rounded-xl !px-3.5 !py-2.5 text-sm"
                />
              </label>
              <Field label="PwBD status" value={data.pwbdStatus} onChange={(value) => updateField("pwbdStatus", value)} optional />
              <Field label="Domicile" value={data.domicile} onChange={(value) => updateField("domicile", value)} optional />
              <Field label="Employment registration number" value={data.employmentRegistration} onChange={(value) => updateField("employmentRegistration", value)} optional />
              <Field label="Relevant identification details" value={data.identificationDetails} onChange={(value) => updateField("identificationDetails", value)} multiline optional />
              <Field label="Professional registration" value={data.professionalRegistration} onChange={(value) => updateField("professionalRegistration", value)} optional />
              <Field label="Examination qualifications" value={data.examinationQualifications} onChange={(value) => updateField("examinationQualifications", value)} multiline optional />
              <Field label="Other recruitment-specific details" value={data.recruitmentDetails} onChange={(value) => updateField("recruitmentDetails", value)} multiline optional />
            </SectionPanel>

            <SectionPanel title="Family and declaration">
              <Field label="Family details" value={data.familyDetails} onChange={(value) => updateField("familyDetails", value)} multiline optional />
              <Field label="Declaration text" value={data.declaration} onChange={(value) => updateField("declaration", value)} multiline optional />
              <Field label="Place" value={data.place} onChange={(value) => updateField("place", value)} optional />
              <Field label="Date" value={data.declarationDate} onChange={(value) => updateField("declarationDate", value)} type="date" optional />
              <label className="block text-sm font-medium text-ink-secondary">Signature image <span className="ml-1 text-xs font-normal text-ink-muted">Optional · PNG/JPEG, max 5 MB</span>
                <InputField type="file" accept="image/png,image/jpeg" onChange={(event) => void selectImage("signature", event.target.files?.[0])} className="mt-1.5 w-full rounded-xl file:mr-3 file:rounded-md file:border-0 file:bg-action-subtle file:px-2 file:py-1 file:text-xs" />
                {data.signature && <button type="button" onClick={() => updateField("signature", "")} className="mt-1 text-xs font-medium text-danger">Remove signature</button>}
              </label>
            </SectionPanel>

            <SectionPanel title="Additional custom sections">
              <p className="text-xs leading-5 text-ink-muted sm:col-span-2">Add other information requested for this specific application. Unknown details are not filled in automatically.</p>
              {data.customSections.map((section, index) => (
                <div key={index} className="grid gap-3 rounded-xl border border-ui-subtle p-3 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">Custom section {index + 1}</h3>
                    <div className="flex items-center">
                      <button type="button" aria-label={`Move custom section ${index + 1} up`} disabled={index === 0} onClick={() => updateField("customSections", data.customSections.map((item, itemIndex, all) => itemIndex === index ? all[index - 1] : itemIndex === index - 1 ? all[index] : item))} className="rounded-lg p-1.5 text-ink-muted hover:text-action disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" aria-label={`Move custom section ${index + 1} down`} disabled={index === data.customSections.length - 1} onClick={() => updateField("customSections", data.customSections.map((item, itemIndex, all) => itemIndex === index ? all[index + 1] : itemIndex === index + 1 ? all[index] : item))} className="rounded-lg p-1.5 text-ink-muted hover:text-action disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                      <button type="button" aria-label={`Remove custom section ${index + 1}`} onClick={() => updateField("customSections", data.customSections.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-subtle hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <Field label="Section heading" value={section.title} onChange={(value) => updateField("customSections", data.customSections.map((item, itemIndex) => itemIndex === index ? { ...item, title: value } : item))} />
                  <Field label="Details" value={section.content} onChange={(value) => updateField("customSections", data.customSections.map((item, itemIndex) => itemIndex === index ? { ...item, content: value } : item))} multiline />
                </div>
              ))}
              <button type="button" onClick={() => updateField("customSections", [...data.customSections, { title: "", content: "" }])} className="inline-flex items-center gap-2 justify-self-start rounded-lg border border-ui px-3 py-2 text-xs font-semibold text-ink-secondary hover:bg-surface-subtle"><Plus className="h-4 w-4" />Add custom section</button>
            </SectionPanel>
              </>
            )}

            {activeStep === 6 && (
              <section className="bento-panel p-4 sm:p-6" aria-label="Choose included sections">
                <div>
                  <h2 className="text-sm font-bold text-ink-primary">Choose your sections</h2>
                  <p className="mt-1 text-xs leading-5 text-ink-muted">We selected a starting set for {purpose.toLowerCase()}. Turn sections on or off, then arrange them in the order you want.</p>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {RESUME_SECTIONS.map(({ id, title }) => {
                    const index = sections.indexOf(id);
                    return (
                      <div key={id} className={`flex items-center gap-2 rounded-xl border p-2.5 transition ${index >= 0 ? "border-action-border bg-action-subtle/40" : "border-ui bg-surface"}`}>
                        <input
                          type="checkbox"
                          checked={index >= 0}
                          onChange={(event) => setSections((current) => event.target.checked
                            ? [...current, id]
                            : current.filter((section) => section !== id))}
                          className="h-4 w-4 accent-action"
                          aria-label={`Include ${title}`}
                        />
                        <span className="min-w-0 flex-1 text-xs font-medium text-ink-secondary">{title}</span>
                        {index >= 0 && (
                          <span className="flex items-center gap-1">
                            <span className="mr-1 text-[10px] text-ink-muted">{index + 1}</span>
                            <button type="button" aria-label={`Move ${title} up`} disabled={index === 0} onClick={() => reorderSection(index, -1)} className="rounded-md p-1 text-ink-muted hover:bg-surface hover:text-action disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                            <button type="button" aria-label={`Move ${title} down`} disabled={index === sections.length - 1} onClick={() => reorderSection(index, 1)} className="rounded-md p-1 text-ink-muted hover:bg-surface hover:text-action disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <div className="flex items-center justify-between rounded-2xl border border-ui bg-surface p-3 shadow-sm sm:p-4">
              <button type="button" onClick={() => setActiveStep((step) => Math.max(0, step - 1))} disabled={activeStep === 0} className="rounded-xl border border-ui px-4 py-2 text-sm font-semibold text-ink-secondary transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40">Back</button>
              <span className="text-xs font-medium text-ink-muted">Step {activeStep + 1} of {workflowSteps.length}</span>
              {activeStep < workflowSteps.length - 1 ? (
                <button type="button" onClick={() => setActiveStep((step) => Math.min(workflowSteps.length - 1, step + 1))} className="rounded-xl bg-action px-4 py-2 text-sm font-semibold text-ink-inverse transition hover:bg-action-hover">Continue</button>
              ) : (
                <button type="button" onClick={() => void exportDocument("pdf")} className="inline-flex items-center gap-2 rounded-xl bg-action px-4 py-2 text-sm font-semibold text-ink-inverse transition hover:bg-action-hover"><ArrowDownToLine className="h-4 w-4" />Finish & export</button>
              )}
            </div>
          </div>

          <aside className="lg:sticky lg:top-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink-primary">Live preview</h2>
              <span className="rounded-full bg-surface px-2.5 py-1 text-[10px] font-semibold text-ink-muted shadow-sm">A4 · {style === "ats" ? "ATS" : style === "modern" ? "Modern" : "Traditional"}</span>
            </div>
            <article id="resume-live-preview" className={`min-h-[480px] scroll-mt-5 rounded-xl border border-ui bg-surface px-6 py-7 shadow-lg sm:px-8 ${style === "modern" ? "border-t-4 border-t-action" : ""}`}>
              <div className={`border-b pb-4 text-center ${style === "traditional" ? "border-b-2 border-ui-strong" : "border-ui"}`}>
                {data.photo && <img src={data.photo} alt="Applicant photograph" className="mb-2 ml-auto h-16 w-14 object-cover" />}
                <h2 className="mt-2 break-words text-xl font-bold text-ink-primary">{data.fullName || "Your name"}</h2>
                {[data.phone, data.email, data.presentAddress || data.permanentAddress].filter(hasValue).length > 0 && (
                  <p className="mt-2 break-words text-[10px] leading-4 text-ink-muted">
                    {[data.phone, data.email, data.presentAddress || data.permanentAddress].filter(hasValue).join("  |  ")}
                  </p>
                )}
              </div>
              {hasPreview ? previewContent.map((section, index) => (
                <section key={`${section.heading}-${index}`} className="mt-4">
                  <h3 className={`border-b pb-1 text-[10px] font-bold uppercase tracking-wider ${style === "traditional" ? "border-ui-strong text-ink-primary" : style === "modern" ? "border-action-border text-action" : "border-ui text-ink-secondary"}`}>{section.heading}</h3>
                  <p className="mt-1.5 whitespace-pre-line break-words text-[11px] leading-5 text-ink-secondary">{section.lines.join("\n")}</p>
                </section>
              )) : (
                <p className="mt-8 text-center text-sm text-ink-faint">Enter details and select relevant sections to preview your document.</p>
              )}
              {data.declaration && sections.includes("declaration") && (
                <div className="mt-8 flex justify-between text-[10px] text-ink-muted">
                  <span>{data.place}{data.declarationDate ? ` · ${formatBiodataDate(data.declarationDate)}` : ""}</span>
                  <span>Signature</span>
                </div>
              )}
              {data.signature && <img src={data.signature} alt="Applicant signature" className="ml-auto mt-6 h-10 max-w-32 object-contain" />}
            </article>
          </aside>
        </div>
      </div>
    </main>
  );
}
