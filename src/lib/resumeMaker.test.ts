import { describe, expect, it } from "vitest";
import { generateResumeText, splitResumeEntries } from "./resumeMaker";
import { RESUME_TEMPLATES } from "./resumeMakerTemplates";

describe("resume maker", () => {
  it("offers distinct resume templates", () => {
    expect(RESUME_TEMPLATES).toHaveLength(3);
    expect(new Set(RESUME_TEMPLATES.map(({ id }) => id)).size).toBe(3);
  });

  it("splits multiline entries and ignores blank lines", () => {
    expect(splitResumeEntries(" Designer\n\nDeveloper \r\n")).toEqual([
      "Designer",
      "Developer",
    ]);
  });

  it("builds a text resume with only the supplied sections", () => {
    expect(
      generateResumeText({
        fullName: "Rina Das",
        headline: "Product Designer",
        email: "rina@example.com",
        phone: "",
        location: "Dhaka",
        summary: "Designs accessible digital products.",
        experience: "Designer, Studio One, 2022–2025\n",
        education: "",
        skills: "Research\nPrototyping",
      }),
    ).toBe(
      "Rina Das\nProduct Designer\nDhaka | rina@example.com\n\n" +
        "PROFESSIONAL SUMMARY\nDesigns accessible digital products.\n\n" +
        "EXPERIENCE\nDesigner, Studio One, 2022–2025\n\n" +
        "SKILLS\nResearch · Prototyping",
    );
  });
});
