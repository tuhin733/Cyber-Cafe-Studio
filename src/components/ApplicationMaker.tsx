import { useMemo, useState } from "react";
import {
  ClipboardList,
  Copy,
  Download,
  Search,
} from "lucide-react";
import BackToToolsButton from "./BackToToolsButton";
import {
  APPLICATION_TEMPLATE_GROUPS,
  APPLICATION_TEMPLATES,
} from "../lib/applicationMakerTemplates";
import {
  generateApplicationText,
  type ApplicationLanguage,
} from "../lib/applicationMaker";

interface Props {
  onClose: () => void;
}

const languageCopy = {
  english: {
    title: "Application Maker",
    description:
      "Choose a ready-made application template, add your details, and create a formal letter.",
    language: "Application language",
    search: "Search templates",
    searchPlaceholder: "Search by application type...",
    category: "Category",
    allCategories: "All categories",
    templates: "Templates",
    details: "Your details",
    recipient: "Recipient / office",
    organization: "Organization",
    applicant: "Your full name",
    address: "Your address",
    contact: "Phone or email",
    date: "Date",
    reason: "Reason / request details",
    reasonPlaceholder: "Add dates, reference numbers, or other relevant details...",
    preview: "Application preview",
    copy: "Copy text",
    download: "Download .txt",
    copied: "Application copied.",
    copyError: "Could not copy the application. Check clipboard permissions and try again.",
    downloaded: "Text file downloaded.",
    noTemplates: "No templates match your search.",
    selected: "Selected template",
  },
  bengali: {
    title: "আবেদনপত্র তৈরি",
    description:
      "একটি প্রস্তুত আবেদনপত্র বেছে নিন, আপনার তথ্য যোগ করুন এবং আনুষ্ঠানিক চিঠি তৈরি করুন।",
    language: "আবেদনের ভাষা",
    search: "আবেদনপত্র খুঁজুন",
    searchPlaceholder: "আবেদনের ধরন লিখে খুঁজুন...",
    category: "বিভাগ",
    allCategories: "সব বিভাগ",
    templates: "নমুনা",
    details: "আপনার তথ্য",
    recipient: "প্রাপক / দপ্তর",
    organization: "প্রতিষ্ঠান",
    applicant: "আপনার পুরো নাম",
    address: "আপনার ঠিকানা",
    contact: "ফোন বা ইমেইল",
    date: "তারিখ",
    reason: "আবেদনের কারণ / বিস্তারিত",
    reasonPlaceholder: "তারিখ, রেফারেন্স নম্বর বা প্রাসঙ্গিক তথ্য লিখুন...",
    preview: "আবেদনের পূর্বরূপ",
    copy: "লেখা কপি করুন",
    download: ".txt ডাউনলোড",
    copied: "আবেদনপত্র কপি হয়েছে।",
    copyError: "আবেদনপত্র কপি করা যায়নি। ক্লিপবোর্ড অনুমতি পরীক্ষা করে আবার চেষ্টা করুন।",
    downloaded: "টেক্সট ফাইল ডাউনলোড হয়েছে।",
    noTemplates: "আপনার অনুসন্ধানের সঙ্গে কোনো নমুনা মেলেনি।",
    selected: "নির্বাচিত নমুনা",
  },
  hindi: {
    title: "आवेदन निर्माता",
    description:
      "तैयार आवेदन प्रारूप चुनें, अपनी जानकारी भरें और औपचारिक पत्र तैयार करें।",
    language: "आवेदन की भाषा",
    search: "आवेदन खोजें",
    searchPlaceholder: "आवेदन के प्रकार से खोजें...",
    category: "श्रेणी",
    allCategories: "सभी श्रेणियाँ",
    templates: "प्रारूप",
    details: "आपकी जानकारी",
    recipient: "प्राप्तकर्ता / कार्यालय",
    organization: "संस्था",
    applicant: "आपका पूरा नाम",
    address: "आपका पता",
    contact: "फ़ोन या ईमेल",
    date: "दिनांक",
    reason: "कारण / अनुरोध का विवरण",
    reasonPlaceholder: "तारीखें, संदर्भ संख्या या अन्य उपयोगी जानकारी लिखें...",
    preview: "आवेदन का पूर्वावलोकन",
    copy: "पाठ कॉपी करें",
    download: ".txt डाउनलोड करें",
    copied: "आवेदन कॉपी हो गया।",
    copyError: "आवेदन कॉपी नहीं हो सका। क्लिपबोर्ड अनुमति जाँचें और फिर प्रयास करें।",
    downloaded: "टेक्स्ट फ़ाइल डाउनलोड हो गई।",
    noTemplates: "आपकी खोज से कोई प्रारूप नहीं मिला।",
    selected: "चुना हुआ प्रारूप",
  },
} satisfies Record<ApplicationLanguage, Record<string, string>>;

const today = new Date();
const todayValue = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0"),
].join("-");

function isApplicationLanguage(value: string): value is ApplicationLanguage {
  return value === "english" || value === "bengali" || value === "hindi";
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-semibold text-ink-secondary">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-ui bg-surface px-3 py-2.5 text-sm text-ink-primary outline-none transition focus:border-action focus:ring-4 focus:ring-action-subtle"
      />
    </label>
  );
}

export default function ApplicationMaker({ onClose }: Props) {
  const [language, setLanguage] = useState<ApplicationLanguage>("english");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(APPLICATION_TEMPLATES[0].id);
  const [date, setDate] = useState(todayValue);
  const [recipient, setRecipient] = useState("");
  const [organization, setOrganization] = useState("");
  const [applicant, setApplicant] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const text = languageCopy[language];

  const selectedTemplate =
    APPLICATION_TEMPLATES.find((template) => template.id === selectedId) ??
    APPLICATION_TEMPLATES[0];
  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return APPLICATION_TEMPLATES.filter((template) => {
      const matchesCategory = category === "all" || template.category === category;
      const matchesQuery =
        !normalizedQuery ||
        `${template.title} ${template.category} ${template.subcategory}`
          .toLocaleLowerCase()
          .includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);
  const application = useMemo(
    () =>
      generateApplicationText({
        language,
        date,
        recipient,
        organization,
        applicant,
        address,
        contact,
        reason,
        title: selectedTemplate.title,
      }),
    [
      address,
      applicant,
      contact,
      date,
      language,
      organization,
      reason,
      recipient,
      selectedTemplate.title,
    ],
  );

  const copyApplication = async () => {
    try {
      await navigator.clipboard.writeText(application);
      setMessage(text.copied);
    } catch {
      setMessage(text.copyError);
    }
  };

  const downloadApplication = () => {
    const blob = new Blob([application], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const fileName = selectedTemplate.title
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    anchor.href = url;
    anchor.download = `${fileName || "application"}.txt`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(text.downloaded);
  };

  return (
    <main className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto bg-surface-muted">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-7 sm:py-7">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <BackToToolsButton onClick={onClose} toolName={text.title} />
            <div className="mt-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-action-subtle text-action">
                <ClipboardList className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-ink-primary sm:text-2xl">
                  {text.title}
                </h1>
                <p className="mt-1 text-sm text-ink-secondary">{text.description}</p>
              </div>
            </div>
          </div>
          <label className="block w-full sm:w-52">
            <span className="mb-1.5 block text-xs font-semibold text-ink-secondary">
              {text.language}
            </span>
            <select
              value={language}
              onChange={(event) => {
                if (isApplicationLanguage(event.target.value)) {
                  setLanguage(event.target.value);
                  setMessage("");
                }
              }}
              className="w-full rounded-xl border border-ui bg-surface px-3 py-2.5 text-sm text-ink-primary outline-none focus:border-action focus:ring-4 focus:ring-action-subtle"
            >
              <option value="english">English</option>
              <option value="bengali">বাংলা</option>
              <option value="hindi">हिन्दी</option>
            </select>
          </label>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(17rem,0.82fr)_minmax(0,1.5fr)]">
          <section className="overflow-hidden rounded-2xl border border-ui bg-surface shadow-sm">
            <div className="border-b border-ui p-4">
              <label className="block">
                <span className="sr-only">{text.search}</span>
                <span className="flex items-center gap-2 rounded-xl border border-ui bg-surface-muted px-3">
                  <Search className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={text.searchPlaceholder}
                    className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-ink-primary outline-none placeholder:text-ink-muted"
                  />
                </span>
              </label>
              <label className="mt-3 block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-secondary">
                  {text.category}
                </span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="w-full rounded-xl border border-ui bg-surface px-3 py-2.5 text-sm text-ink-primary outline-none focus:border-action focus:ring-4 focus:ring-action-subtle"
                >
                  <option value="all">{text.allCategories}</option>
                  {APPLICATION_TEMPLATE_GROUPS.map((group) => (
                    <option key={group.category} value={group.category}>
                      {group.category}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="max-h-[34rem] overflow-y-auto p-3">
              <h2 className="px-2 pb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
                {text.templates} ({filteredTemplates.length})
              </h2>
              {filteredTemplates.length > 0 ? (
                <div className="space-y-1">
                  {filteredTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      aria-pressed={selectedId === template.id}
                      onClick={() => {
                        setSelectedId(template.id);
                        setMessage("");
                      }}
                      className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-action ${
                        selectedId === template.id
                          ? "bg-action-subtle text-action"
                          : "text-ink-primary hover:bg-surface-subtle"
                      }`}
                    >
                      <span className="block text-xs font-semibold leading-5">
                        {template.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-ink-muted">
                        {template.subcategory}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-surface-muted px-3 py-6 text-center text-sm text-ink-muted">
                  {text.noTemplates}
                </p>
              )}
            </div>
          </section>

          <div className="space-y-5">
            <section className="rounded-2xl border border-ui bg-surface p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-ink-primary">
                    {text.details}
                  </h2>
                  <p className="mt-1 text-xs text-ink-muted">{text.selected}: {selectedTemplate.title}</p>
                </div>
                <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-[11px] font-medium text-ink-secondary">
                  {selectedTemplate.category}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={text.recipient} value={recipient} onChange={setRecipient} />
                <Field
                  label={text.organization}
                  value={organization}
                  onChange={setOrganization}
                />
                <Field label={text.applicant} value={applicant} onChange={setApplicant} />
                <Field label={text.date} type="date" value={date} onChange={setDate} />
                <Field label={text.address} value={address} onChange={setAddress} />
                <Field label={text.contact} value={contact} onChange={setContact} />
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold text-ink-secondary">
                    {text.reason}
                  </span>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={text.reasonPlaceholder}
                    className="w-full resize-y rounded-xl border border-ui bg-surface px-3 py-2.5 text-sm text-ink-primary outline-none transition placeholder:text-ink-muted focus:border-action focus:ring-4 focus:ring-action-subtle"
                  />
                </label>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-ui bg-surface shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ui px-4 py-3 sm:px-5">
                <h2 className="text-base font-semibold text-ink-primary">
                  {text.preview}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyApplication()}
                    className="inline-flex items-center gap-2 rounded-lg border border-ui px-3 py-2 text-xs font-semibold text-ink-secondary transition hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-action"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    {text.copy}
                  </button>
                  <button
                    type="button"
                    onClick={downloadApplication}
                    className="inline-flex items-center gap-2 rounded-lg bg-action px-3 py-2 text-xs font-semibold text-ink-inverse transition hover:bg-action-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    {text.download}
                  </button>
                </div>
              </div>
              <pre className="scrollbar-hidden max-h-[34rem] min-h-72 overflow-auto whitespace-pre-wrap break-words px-5 py-5 font-sans text-sm leading-7 text-ink-primary">
                {application}
              </pre>
              {message && (
                <p role="status" className="border-t border-ui px-5 py-2.5 text-xs text-ink-secondary">
                  {message}
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
