import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Download, FileText, Printer } from "lucide-react";
import BackToToolsButton from "./BackToToolsButton";
import {
  generateResumeText,
  splitResumeEntries,
  type ResumeDetails,
} from "../lib/resumeMaker";
import { RESUME_TEMPLATES } from "../lib/resumeMakerTemplates";

interface Props {
  onClose: () => void;
}

const initialDetails: ResumeDetails = {
  fullName: "",
  headline: "",
  email: "",
  phone: "",
  location: "",
  summary: "",
  experience: "",
  education: "",
  skills: "",
};

function TextField({
  label,
  value,
  onChange,
  multiline = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const className =
    "w-full rounded-xl border border-ui bg-surface px-3 py-2.5 text-sm text-ink-primary outline-none transition placeholder:text-ink-muted focus:border-action focus:ring-4 focus:ring-action-subtle";

  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-semibold text-ink-secondary">
        {label}
      </span>
      {multiline ? (
        <textarea
          rows={3}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`${className} resize-y`}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={className}
        />
      )}
    </label>
  );
}

export default function ResumeMaker({ onClose }: Props) {
  const [details, setDetails] = useState(initialDetails);
  const [selectedTemplateId, setSelectedTemplateId] = useState("classic");
  const [message, setMessage] = useState("");

  const selectedTemplate =
    RESUME_TEMPLATES.find(({ id }) => id === selectedTemplateId) ??
    RESUME_TEMPLATES[0];
  const contact = [details.location, details.phone, details.email]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" · ");
  const experience = useMemo(
    () => splitResumeEntries(details.experience),
    [details.experience],
  );
  const education = useMemo(
    () => splitResumeEntries(details.education),
    [details.education],
  );
  const skills = useMemo(
    () => splitResumeEntries(details.skills),
    [details.skills],
  );

  const update = (field: keyof ResumeDetails, value: string) => {
    setDetails((current) => ({ ...current, [field]: value }));
  };

  const downloadText = () => {
    const blob = new Blob([generateResumeText(details)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeName = details.fullName
      .trim()
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    anchor.href = url;
    anchor.download = `${safeName || "resume"}.txt`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Resume text downloaded.");
  };

  return (
    <main className="resume-maker-screen scrollbar-hidden min-h-0 flex-1 overflow-y-auto bg-surface-muted">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-7 sm:py-7">
        <div className="mb-6">
          <BackToToolsButton onClick={onClose} toolName="Resume Maker" />
          <div className="mt-4 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-action-subtle text-action">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-ink-primary sm:text-2xl">
                Resume Maker
              </h1>
              <p className="mt-1 text-sm text-ink-secondary">
                Choose a template, add your details, and preview your resume.
              </p>
            </div>
          </div>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-ui bg-surface p-4 shadow-sm sm:p-5">
              <h2 className="mb-3 text-base font-semibold text-ink-primary">
                Choose a template
              </h2>
              <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                {RESUME_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    aria-pressed={selectedTemplate.id === template.id}
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={`rounded-xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-action ${
                      selectedTemplate.id === template.id
                        ? "border-action bg-action-subtle"
                        : "border-ui hover:bg-surface-muted"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-ink-primary">
                      {template.name}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-ink-secondary">
                      {template.description}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-ui bg-surface p-4 shadow-sm sm:p-5">
              <h2 className="mb-4 text-base font-semibold text-ink-primary">
                Your details
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label="Full name"
                  value={details.fullName}
                  onChange={(value) => update("fullName", value)}
                  placeholder="Your name"
                />
                <TextField
                  label="Professional title"
                  value={details.headline}
                  onChange={(value) => update("headline", value)}
                  placeholder="e.g. Graphic Designer"
                />
                <TextField
                  label="Email"
                  value={details.email}
                  onChange={(value) => update("email", value)}
                  placeholder="you@example.com"
                />
                <TextField
                  label="Phone"
                  value={details.phone}
                  onChange={(value) => update("phone", value)}
                  placeholder="+1 555 0100"
                />
                <div className="sm:col-span-2">
                  <TextField
                    label="Location"
                    value={details.location}
                    onChange={(value) => update("location", value)}
                    placeholder="City, Country"
                  />
                </div>
                <div className="sm:col-span-2">
                  <TextField
                    label="Professional summary"
                    value={details.summary}
                    onChange={(value) => update("summary", value)}
                    multiline
                    placeholder="Briefly describe your experience and strengths."
                  />
                </div>
                <div className="sm:col-span-2">
                  <TextField
                    label="Experience"
                    value={details.experience}
                    onChange={(value) => update("experience", value)}
                    multiline
                    placeholder={"One role per line, e.g.\nDesigner, Studio One, 2022–2025"}
                  />
                </div>
                <div className="sm:col-span-2">
                  <TextField
                    label="Education"
                    value={details.education}
                    onChange={(value) => update("education", value)}
                    multiline
                    placeholder={"One qualification per line, e.g.\nBA Design, City University, 2022"}
                  />
                </div>
                <div className="sm:col-span-2">
                  <TextField
                    label="Skills"
                    value={details.skills}
                    onChange={(value) => update("skills", value)}
                    multiline
                    placeholder="Add one skill per line."
                  />
                </div>
              </div>
            </section>
          </div>

          <section className="overflow-hidden rounded-2xl border border-ui bg-surface shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ui px-4 py-3 sm:px-5">
              <div>
                <h2 className="text-base font-semibold text-ink-primary">
                  Live preview
                </h2>
                <p className="mt-1 text-xs text-ink-muted">
                  {selectedTemplate.name} template
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 rounded-lg border border-ui px-3 py-2 text-xs font-semibold text-ink-secondary transition hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-action"
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                  Print / PDF
                </button>
                <button
                  type="button"
                  onClick={downloadText}
                  className="inline-flex items-center gap-2 rounded-lg bg-action px-3 py-2 text-xs font-semibold text-ink-inverse transition hover:bg-action-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Download .txt
                </button>
              </div>
            </div>

            <article
              className={`resume-print-area mx-auto min-h-[38rem] max-w-2xl bg-surface p-7 text-ink-primary sm:p-10 ${selectedTemplate.pageClass}`}
            >
              <header className={selectedTemplate.headerClass}>
                <h2 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">
                  {details.fullName || "Your Name"}
                </h2>
                {details.headline && (
                  <p className="mt-1 text-base font-medium text-ink-secondary">
                    {details.headline}
                  </p>
                )}
                {contact && (
                  <p className="mt-2 break-words text-xs leading-5 text-ink-muted">
                    {contact}
                  </p>
                )}
              </header>

              <div className="space-y-5 pt-5">
                {details.summary.trim() && (
                  <ResumeSection
                    title="Professional Summary"
                    headingClass={selectedTemplate.sectionHeadingClass}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-6 text-ink-secondary">
                      {details.summary.trim()}
                    </p>
                  </ResumeSection>
                )}
                {experience.length > 0 && (
                  <ResumeListSection
                    title="Experience"
                    entries={experience}
                    headingClass={selectedTemplate.sectionHeadingClass}
                  />
                )}
                {education.length > 0 && (
                  <ResumeListSection
                    title="Education"
                    entries={education}
                    headingClass={selectedTemplate.sectionHeadingClass}
                  />
                )}
                {skills.length > 0 && (
                  <ResumeSection
                    title="Skills"
                    headingClass={selectedTemplate.sectionHeadingClass}
                  >
                    <p className="text-sm leading-6 text-ink-secondary">
                      {skills.join(" · ")}
                    </p>
                  </ResumeSection>
                )}
                {!details.summary.trim() &&
                  experience.length === 0 &&
                  education.length === 0 &&
                  skills.length === 0 && (
                    <p className="py-12 text-center text-sm text-ink-muted">
                      Your resume sections will appear here as you fill them in.
                    </p>
                  )}
              </div>
            </article>
            {message && (
              <p role="status" className="border-t border-ui px-5 py-2.5 text-xs text-ink-secondary">
                {message}
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function ResumeSection({
  title,
  headingClass,
  children,
}: {
  title: string;
  headingClass: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3
        className={`mb-2 text-xs font-bold uppercase tracking-wider ${headingClass}`}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function ResumeListSection({
  title,
  entries,
  headingClass,
}: {
  title: string;
  entries: string[];
  headingClass: string;
}) {
  return (
    <ResumeSection title={title} headingClass={headingClass}>
      <ul className="space-y-1.5">
        {entries.map((entry, index) => (
          <li
            key={`${title}-${index}`}
            className="whitespace-pre-wrap text-sm leading-6 text-ink-secondary"
          >
            {entry}
          </li>
        ))}
      </ul>
    </ResumeSection>
  );
}
