import { describe, expect, it } from "vitest";
import {
  APPLICATION_TEMPLATES,
  APPLICATION_TEMPLATE_GROUPS,
} from "./applicationMakerTemplates";
import { generateApplicationText } from "./applicationMaker";

describe("application maker templates", () => {
  it("includes the complete application catalog with unique identifiers", () => {
    expect(APPLICATION_TEMPLATES).toHaveLength(81);
    expect(new Set(APPLICATION_TEMPLATES.map(({ id }) => id)).size).toBe(81);
    expect(APPLICATION_TEMPLATE_GROUPS).toHaveLength(6);
  });

  it.each([
    ["english", "Subject:", "Dear Sir/Madam,"],
    ["bengali", "বিষয়:", "মাননীয় মহোদয়/মহোদয়া,"],
    ["hindi", "विषय:", "महोदय/महोदया,"],
  ] as const)("creates a %s application in the selected language", (
    language,
    subject,
    greeting,
  ) => {
    const application = generateApplicationText({
      language,
      date: "2026-11-09",
      recipient: "The Principal",
      organization: "Example College",
      applicant: "Rina Das",
      address: "12 Lake Road",
      contact: "555-0100",
      reason: "I was unwell from 2 to 4 November.",
      title: "Sick Leave Application",
    });

    expect(application).toContain(subject);
    expect(application).toContain(greeting);
    expect(application).toContain("Rina Das");
    expect(application).toContain("Sick Leave Application");
  });

  it("uses localized placeholders without duplicating an unfilled reason", () => {
    const application = generateApplicationText({
      language: "bengali",
      date: "",
      recipient: "",
      organization: "",
      applicant: "",
      address: "",
      contact: "",
      reason: "",
      title: "Sick Leave Application",
    });

    expect(application).toContain("[তারিখ]");
    expect(application).toContain("[আপনার নাম]");
    expect(application).not.toContain("আবেদনের বিস্তারিত:");
  });
});
