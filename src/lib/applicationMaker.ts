export type ApplicationLanguage = "english" | "bengali" | "hindi";

export interface ApplicationDetails {
  language: ApplicationLanguage;
  date: string;
  recipient: string;
  organization: string;
  applicant: string;
  address: string;
  contact: string;
  reason: string;
  title: string;
}

const copy = {
  english: {
    date: "Date",
    datePlaceholder: "[Date]",
    to: "To",
    recipientPlaceholder: "[Recipient / office]",
    subject: "Subject",
    titlePlaceholder: "[Application purpose]",
    greeting: "Dear Sir/Madam,",
    applicantPlaceholder: "[Your name]",
    intro: "I, {applicant}, respectfully submit this application regarding {title}.",
    reason: "Details of my request: {reason}",
    request:
      "I kindly request you to consider my application and take the necessary action. I am ready to provide supporting documents if required.",
    thanks: "Thank you for your time and consideration.",
    closing: "Yours faithfully,",
  },
  bengali: {
    date: "তারিখ",
    datePlaceholder: "[তারিখ]",
    to: "বরাবর",
    recipientPlaceholder: "[প্রাপক / দপ্তর]",
    subject: "বিষয়",
    titlePlaceholder: "[আবেদনের বিষয়]",
    greeting: "মাননীয় মহোদয়/মহোদয়া,",
    applicantPlaceholder: "[আপনার নাম]",
    intro:
      "আমি, {applicant}, {title} বিষয়ে বিনীতভাবে এই আবেদন জানাচ্ছি।",
    reason: "আবেদনের বিস্তারিত: {reason}",
    request:
      "অতএব, আমার আবেদনটি বিবেচনা করে প্রয়োজনীয় ব্যবস্থা গ্রহণ করার জন্য বিনীত অনুরোধ করছি। প্রয়োজনে সহায়ক নথি জমা দিতে প্রস্তুত আছি।",
    thanks: "আপনার সময় ও বিবেচনার জন্য ধন্যবাদ।",
    closing: "বিনীত,",
  },
  hindi: {
    date: "दिनांक",
    datePlaceholder: "[दिनांक]",
    to: "सेवा में,",
    recipientPlaceholder: "[प्राप्तकर्ता / कार्यालय]",
    subject: "विषय",
    titlePlaceholder: "[आवेदन का विषय]",
    greeting: "महोदय/महोदया,",
    applicantPlaceholder: "[आपका नाम]",
    intro:
      "मैं, {applicant}, {title} के संबंध में यह आवेदन सादर प्रस्तुत करता/करती हूँ।",
    reason: "मेरे अनुरोध का विवरण: {reason}",
    request:
      "अतः आपसे विनम्र अनुरोध है कि मेरे आवेदन पर विचार कर आवश्यक कार्रवाई करें। आवश्यकता होने पर मैं सहायक दस्तावेज़ प्रस्तुत करने के लिए तैयार हूँ।",
    thanks: "आपके समय और विचार के लिए धन्यवाद।",
    closing: "सधन्यवाद,",
  },
} satisfies Record<
  ApplicationLanguage,
  Record<string, string>
>;

function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? "");
}

export function generateApplicationText(details: ApplicationDetails): string {
  const phrases = copy[details.language];
  const applicant = details.applicant.trim() || phrases.applicantPlaceholder;
  const title = details.title.trim() || phrases.titlePlaceholder;
  const reason = details.reason.trim();
  const values = { applicant, title, reason };
  const recipient = details.recipient.trim() || phrases.recipientPlaceholder;
  const organization = details.organization.trim();
  const address = details.address.trim();
  const contact = details.contact.trim();

  return [
    `${phrases.date}: ${details.date.trim() || phrases.datePlaceholder}`,
    [phrases.to, recipient, organization].filter(Boolean).join("\n"),
    `${phrases.subject}: ${title}`,
    [
      phrases.greeting,
      fill(phrases.intro, values),
      ...(reason ? [fill(phrases.reason, values)] : []),
      phrases.request,
      phrases.thanks,
    ].join("\n\n"),
    [phrases.closing, applicant, address, contact].filter(Boolean).join("\n"),
  ]
    .join("\n");
}
