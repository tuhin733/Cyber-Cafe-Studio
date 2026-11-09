export interface ResumeDetails {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  experience: string;
  education: string;
  skills: string;
}

export function splitResumeEntries(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function generateResumeText(details: ResumeDetails): string {
  const contact = [details.location, details.phone, details.email]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" | ");
  const sections = [
    [details.fullName.trim(), details.headline.trim(), contact]
      .filter(Boolean)
      .join("\n"),
    details.summary.trim()
      ? `PROFESSIONAL SUMMARY\n${details.summary.trim()}`
      : "",
    splitResumeEntries(details.experience).length
      ? `EXPERIENCE\n${splitResumeEntries(details.experience).join("\n")}`
      : "",
    splitResumeEntries(details.education).length
      ? `EDUCATION\n${splitResumeEntries(details.education).join("\n")}`
      : "",
    splitResumeEntries(details.skills).length
      ? `SKILLS\n${splitResumeEntries(details.skills).join(" · ")}`
      : "",
  ];

  return sections.filter(Boolean).join("\n\n");
}
