import { describe, expect, it } from "vitest";
import {
  getIndicTransliterationSuggestions,
  INDIC_LANGUAGES,
} from "./indicTransliteration";

describe("Indic transliteration", () => {
  it("offers the requested common Hindi and Bengali spellings", () => {
    expect(getIndicTransliterationSuggestions("namaste", "hi")).toContain("नमस्ते");
    expect(getIndicTransliterationSuggestions("mera", "hi")).toContain("मेरा");
    expect(getIndicTransliterationSuggestions("bharat", "hi")).toContain("भारत");
    expect(getIndicTransliterationSuggestions("dhanyawad", "hi")).toContain("धन्यवाद");
    expect(getIndicTransliterationSuggestions("amar", "bn")).toContain("আমার");
    expect(getIndicTransliterationSuggestions("bangla", "bn")).toContain("বাংলা");
    expect(getIndicTransliterationSuggestions("bhalo", "bn")).toContain("ভালো");
  });

  it("generates local suggestions for the supported scripts and skips English", () => {
    for (const { value } of INDIC_LANGUAGES.slice(1)) {
      expect(getIndicTransliterationSuggestions("namaste", value).length).toBeGreaterThan(0);
    }
    expect(getIndicTransliterationSuggestions("namaste", "en")).toEqual([]);
    expect(getIndicTransliterationSuggestions("nam1", "hi")).toEqual([]);
  });
});
