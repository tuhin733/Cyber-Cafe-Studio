import { useState } from "react";
import {
  ArrowDownToLine,
  BriefcaseBusiness,
  CheckCircle2,
  Circle,
  FileText,
  GraduationCap,
  UserRound,
} from "lucide-react";
import BackToToolsButton from "./BackToToolsButton";
import Dropdown from "./Dropdown";
import {
  BIODATA_RESUME_TEMPLATES,
  BIODATA_RESUME_STYLES,
  formatBiodataDate,
  generateBiodataResumePdf,
  type BiodataResumeData,
  type BiodataResumeStyle,
  type BiodataResumeTemplate,
} from "../lib/biodataResume";
import { savePDF } from "../lib/pdf";
import { notifyUserError } from "../lib/userErrors";
import { notifyUserSuccess } from "../lib/userNotifications";

interface Props {
  onClose: () => void;
}

const emptyData: BiodataResumeData = {
  biodataTitle: "",
  fullName: "",
  phone: "",
  email: "",
  address: "",
  objective: "",
  education: "",
  experience: "",
  skills: "",
  dateOfBirth: "",
  gender: "",
  height: "",
  religion: "",
  nationality: "",
  maritalStatus: "",
  familyDetails: "",
  about: "",
  additionalDetails: "",
};

const templateStyleOptions = BIODATA_RESUME_STYLES.map(({ id, name }) => ({
  value: id,
  label: name,
}));

function Field({
  label,
  value,
  onChange,
  multiline = false,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  type?: string;
}) {
  const className =
    "w-full rounded-xl border border-ui bg-surface px-3.5 py-2.5 text-sm text-ink-primary outline-none transition focus:border-action-emphasis focus:ring-4 focus:ring-action-subtle";

  return (
    <label className="block text-sm font-medium text-ink-secondary">
      {label}
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`${className} mt-1.5 resize-y`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`${className} mt-1.5`}
        />
      )}
    </label>
  );
}

function PreviewSection({
  title,
  children,
  style,
}: {
  title: string;
  children: string;
  style: BiodataResumeStyle;
}) {
  if (!children.trim()) return null;
  const headingStyle =
    style === "modern"
      ? "border-action-border text-action"
      : style === "classic"
        ? "border-ui-strong text-ink-primary"
        : "border-ui text-ink-secondary";
  return (
    <section className="mt-5">
      <h3 className={`border-b pb-1.5 text-xs font-bold uppercase tracking-wider ${headingStyle}`}>
        {title}
      </h3>
      <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-ink-secondary">
        {children}
      </p>
    </section>
  );
}

export default function BiodataResumeMaker({ onClose }: Props) {
  const [templateId, setTemplateId] =
    useState<BiodataResumeTemplate>("resume");
  const [templateStyles, setTemplateStyles] = useState<
    Record<BiodataResumeTemplate, BiodataResumeStyle>
  >({
    resume: "modern",
    "personal-biodata": "minimalist",
  });
  const [data, setData] = useState<BiodataResumeData>(emptyData);
  const [isExporting, setIsExporting] = useState(false);
  const template = BIODATA_RESUME_TEMPLATES.find(
    ({ id }) => id === templateId,
  );
  if (!template) throw new Error(`Unknown biodata or resume template: ${templateId}`);
  const selectedStyle = templateStyles[templateId];

  const updateField = (field: keyof BiodataResumeData, value: string) => {
    setData((current) => ({ ...current, [field]: value }));
  };

  const exportPdf = async () => {
    if (!data.fullName.trim()) {
      notifyUserError("Enter the customer's name before creating the PDF.");
      return;
    }

    setIsExporting(true);
    try {
      const pdf = await generateBiodataResumePdf(
        templateId,
        data,
        selectedStyle,
      );
      const safeName = Array.from(
        data.fullName
          .trim()
          .replace(/[<>:"/\\|?*]/g, ""),
      )
        .filter((character) => {
          const code = character.charCodeAt(0);
          return code >= 32 && code !== 127;
        })
        .join("")
        .replace(/\s+/g, "-")
        .slice(0, 80);
      const saved = await savePDF(pdf, `${safeName}-${templateId}.pdf`);
      if (saved) notifyUserSuccess("PDF created successfully.");
    } catch (error) {
      console.error("Could not create the biodata or resume PDF:", error);
      notifyUserError(
        "Couldn't create the PDF. Check the entered details and try again.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const contactLine = [data.phone, data.email, data.address]
    .map((item) => item.trim())
    .filter(Boolean)
    .join("  ·  ");
  const personalDetails = [
    ["Date of birth", formatBiodataDate(data.dateOfBirth)],
    ["Gender", data.gender],
    ["Height", data.height],
    ["Religion", data.religion],
    ["Nationality", data.nationality],
    ["Marital status", data.maritalStatus],
  ].filter(([, value]) => value.trim());

  return (
    <main className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto bg-surface-muted">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-7 sm:py-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackToToolsButton onClick={onClose} toolName={template.name} />
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

        <section
          className="mt-5 grid max-w-3xl gap-3 sm:grid-cols-2"
          aria-label="Choose a template"
        >
          {BIODATA_RESUME_TEMPLATES.map((item) => {
            const Icon =
              item.kind === "resume" ? BriefcaseBusiness : UserRound;
            const selected = templateId === item.id;
            return (
              <div
                key={item.id}
                className={`group rounded-2xl border p-3.5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                  selected
                    ? "border-action-border-strong bg-action-subtle shadow-sm ring-1 ring-action-outline/30"
                    : "border-ui bg-surface shadow-sm hover:border-ui-strong"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setTemplateId(item.id)}
                  aria-pressed={selected}
                  className="flex w-full items-start gap-3 rounded-xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      selected
                        ? "bg-action-soft text-action"
                        : "bg-surface-subtle text-ink-muted group-hover:bg-action-subtle group-hover:text-action"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5">
                    <span className="block text-sm font-semibold leading-5 text-ink-primary">
                      {item.name}
                    </span>
                    <span className="mt-0.5 block text-xs leading-4 text-ink-muted">
                      {item.description}
                    </span>
                  </span>
                  {selected ? (
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-action"
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle
                      className="mt-0.5 h-4 w-4 shrink-0 text-ink-disabled transition-colors group-hover:text-action"
                      aria-hidden="true"
                    />
                  )}
                </button>
                <div className="ml-12 mt-1 max-w-[180px]">
                  <Dropdown
                    value={templateStyles[item.id]}
                    aria-label={`${item.name} style`}
                    onChange={(value) => {
                      const nextStyle = BIODATA_RESUME_STYLES.find(
                        ({ id }) => id === value,
                      );
                      if (!nextStyle) return;
                      setTemplateStyles((current) => ({
                        ...current,
                        [item.id]: nextStyle.id,
                      }));
                      setTemplateId(item.id);
                    }}
                    options={templateStyleOptions}
                    className="!min-h-0 !w-full !gap-1 !rounded-md !border-0 !bg-transparent !px-0 !py-0 text-xs !font-medium text-ink-muted !shadow-none hover:!border-transparent focus:!border-transparent focus:!ring-0"
                  />
                </div>
              </div>
            );
          })}
        </section>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
          <section className="rounded-2xl border border-ui bg-surface p-4 shadow-sm sm:p-6">
            <div className="mt-6">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink-primary">
                <UserRound className="h-4 w-4 text-action" aria-hidden="true" />
                Basic information
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field
                    label="Full name *"
                    value={data.fullName}
                    onChange={(value) => updateField("fullName", value)}
                    placeholder="Customer's full name"
                  />
                </div>
                <Field
                  label="Phone"
                  value={data.phone}
                  onChange={(value) => updateField("phone", value)}
                  placeholder="+91 98765 43210"
                  type="tel"
                />
                <Field
                  label="Email"
                  value={data.email}
                  onChange={(value) => updateField("email", value)}
                  placeholder="name@example.com"
                  type="email"
                />
                <div className="sm:col-span-2">
                  <Field
                    label="Address"
                    value={data.address}
                    onChange={(value) => updateField("address", value)}
                    placeholder="Locality, city, state, PIN code"
                  />
                </div>
              </div>
            </div>

            {template.kind === "biodata" ? (
              <>
                <div className="mt-6">
                  <Field
                    label="Biodata title or purpose"
                    value={data.biodataTitle}
                    onChange={(value) => updateField("biodataTitle", value)}
                    placeholder="e.g. Student, Marriage, Personal"
                  />
                </div>
                <div className="mt-6">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-ink-primary">
                    <UserRound className="h-4 w-4 text-action" aria-hidden="true" />
                    Personal details
                  </h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Date of birth"
                      value={data.dateOfBirth}
                      onChange={(value) => updateField("dateOfBirth", value)}
                      type="date"
                    />
                    <Field
                      label="Gender"
                      value={data.gender}
                      onChange={(value) => updateField("gender", value)}
                      placeholder="Gender"
                    />
                    <Field
                      label="Height"
                      value={data.height}
                      onChange={(value) => updateField("height", value)}
                      placeholder="e.g. 165 cm"
                    />
                    <Field
                      label="Religion"
                      value={data.religion}
                      onChange={(value) => updateField("religion", value)}
                      placeholder="Religion"
                    />
                    <Field
                      label="Nationality"
                      value={data.nationality}
                      onChange={(value) => updateField("nationality", value)}
                      placeholder="Nationality"
                    />
                    <Field
                      label="Marital status"
                      value={data.maritalStatus}
                      onChange={(value) => updateField("maritalStatus", value)}
                      placeholder="Marital status"
                    />
                  </div>
                </div>
                <div className="mt-6">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-ink-primary">
                    <GraduationCap className="h-4 w-4 text-action" aria-hidden="true" />
                    Education and other details
                  </h2>
                  <div className="mt-4 grid gap-4">
                    <Field
                      label="Education"
                      value={data.education}
                      onChange={(value) => updateField("education", value)}
                      multiline
                      placeholder="Qualification, institution, year"
                    />
                    <Field
                      label="Work and experience"
                      value={data.experience}
                      onChange={(value) => updateField("experience", value)}
                      multiline
                      placeholder="Occupation, workplace, experience"
                    />
                    <Field
                      label="Family details"
                      value={data.familyDetails}
                      onChange={(value) => updateField("familyDetails", value)}
                      multiline
                      placeholder="Family or background information (optional)"
                    />
                    <Field
                      label="Skills and interests"
                      value={data.skills}
                      onChange={(value) => updateField("skills", value)}
                      multiline
                      placeholder="Skills, interests, and hobbies"
                    />
                    <Field
                      label="About me"
                      value={data.about}
                      onChange={(value) => updateField("about", value)}
                      multiline
                      placeholder="A short personal introduction (optional)"
                    />
                    <Field
                      label="Additional details"
                      value={data.additionalDetails}
                      onChange={(value) => updateField("additionalDetails", value)}
                      multiline
                      placeholder="Any other details relevant to this biodata"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-6">
                <h2 className="flex items-center gap-2 text-sm font-bold text-ink-primary">
                  <BriefcaseBusiness className="h-4 w-4 text-action" aria-hidden="true" />
                  Profile and qualifications
                </h2>
                <div className="mt-4 grid gap-4">
                  <Field
                    label="Career objective"
                    value={data.objective}
                    onChange={(value) => updateField("objective", value)}
                    multiline
                    placeholder="A brief objective tailored to the job"
                  />
                  <Field
                    label="Education"
                    value={data.education}
                    onChange={(value) => updateField("education", value)}
                    multiline
                    placeholder="Qualification, institution, year"
                  />
                  <Field
                    label="Experience"
                    value={data.experience}
                    onChange={(value) => updateField("experience", value)}
                    multiline
                    placeholder="Role, workplace, dates, responsibilities"
                  />
                  <Field
                    label="Skills"
                    value={data.skills}
                    onChange={(value) => updateField("skills", value)}
                    multiline
                    placeholder="Customer service, cash handling, computer skills..."
                  />
                </div>
              </div>
            )}
          </section>

          <aside className="lg:sticky lg:top-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-primary">
                <FileText className="h-4 w-4 text-action" aria-hidden="true" />
                Live preview
              </h2>
            </div>
            <article className="min-h-[520px] rounded-sm border border-ui bg-surface px-7 py-9 shadow-md sm:px-10 sm:py-11">
              <div
                className={`pb-5 ${
                  selectedStyle === "modern"
                    ? "-mx-7 -mt-9 mb-5 bg-action px-7 pt-7 sm:-mx-10 sm:-mt-11 sm:px-10 sm:pt-9"
                    : selectedStyle === "classic"
                      ? "border-b-2 border-ui-strong"
                      : "border-b border-ui"
                }`}
              >
                {template.kind === "biodata" && (
                  <p
                    className={`text-[10px] font-bold tracking-[0.18em] ${
                      selectedStyle === "modern"
                        ? "text-ink-inverse"
                        : selectedStyle === "classic"
                          ? "text-action"
                          : "text-ink-muted"
                    }`}
                  >
                    {data.biodataTitle.trim() || template.title}
                  </p>
                )}
                <h2
                  className={`mt-2 break-words text-2xl font-bold tracking-tight ${
                    selectedStyle === "modern"
                      ? "text-ink-inverse"
                      : "text-ink-primary"
                  }`}
                >
                  {data.fullName || "Your name"}
                </h2>
                {contactLine && (
                  <p
                    className={`mt-2 break-words text-xs leading-5 ${
                      selectedStyle === "modern"
                        ? "text-ink-inverse"
                        : "text-ink-muted"
                    }`}
                  >
                    {contactLine}
                  </p>
                )}
              </div>
              {template.kind === "resume" ? (
                <>
                  <PreviewSection title="Career objective" children={data.objective} style={selectedStyle} />
                  <PreviewSection title="Experience" children={data.experience} style={selectedStyle} />
                  <PreviewSection title="Education" children={data.education} style={selectedStyle} />
                  <PreviewSection title="Skills" children={data.skills} style={selectedStyle} />
                </>
              ) : (
                <>
                  {personalDetails.length > 0 && (
                    <section className="mt-5">
                      <h3
                        className={`border-b pb-1.5 text-xs font-bold uppercase tracking-wider ${
                          selectedStyle === "modern"
                            ? "border-action-border text-action"
                            : selectedStyle === "classic"
                              ? "border-ui-strong text-ink-primary"
                              : "border-ui text-ink-secondary"
                        }`}
                      >
                        Personal details
                      </h3>
                      <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-x-3 gap-y-2 text-sm">
                        {personalDetails.map(([label, value]) => (
                          <div key={label} className="contents">
                            <dt className="text-ink-muted">{label}</dt>
                            <dd className="break-words font-medium text-ink-secondary">
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  )}
                  <PreviewSection title="About" children={data.about} style={selectedStyle} />
                  <PreviewSection title="Education" children={data.education} style={selectedStyle} />
                  <PreviewSection title="Work and experience" children={data.experience} style={selectedStyle} />
                  <PreviewSection title="Skills and interests" children={data.skills} style={selectedStyle} />
                  <PreviewSection title="Family and background" children={data.familyDetails} style={selectedStyle} />
                  <PreviewSection
                    title="Additional details"
                    children={data.additionalDetails}
                    style={selectedStyle}
                  />
                </>
              )}
              {!data.objective &&
                !data.education &&
                !data.experience &&
                !data.skills &&
                !data.familyDetails &&
                !data.about &&
                !data.additionalDetails &&
                personalDetails.length === 0 && (
                  <p className="mt-8 text-center text-sm text-ink-faint">
                    Your completed details will appear here.
                  </p>
                )}
            </article>
          </aside>
        </div>
      </div>
    </main>
  );
}
