import Sanscript from "@indic-transliteration/sanscript";

export const INDIC_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "bn", label: "Bengali" },
  { value: "mr", label: "Marathi" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "gu", label: "Gujarati" },
  { value: "kn", label: "Kannada" },
  { value: "ml", label: "Malayalam" },
  { value: "pa", label: "Punjabi" },
  { value: "or", label: "Odia" },
  { value: "as", label: "Assamese" },
] as const;

export type IndicLanguage = (typeof INDIC_LANGUAGES)[number]["value"];

const SCRIPT_BY_LANGUAGE: Partial<Record<IndicLanguage, string>> = {
  hi: "devanagari",
  bn: "bengali",
  mr: "devanagari",
  ta: "tamil",
  te: "telugu",
  gu: "gujarati",
  kn: "kannada",
  ml: "malayalam",
  pa: "gurmukhi",
  or: "oriya",
  as: "assamese",
};

const COMMON_SUGGESTIONS: Partial<Record<IndicLanguage, Record<string, string[]>>> = {
  hi: {
    nam: ["नम", "नाम", "नमः"],
    namaste: ["नमस्ते"],
    mera: ["मेरा"],
    bharat: ["भारत"],
    dhanyawad: ["धन्यवाद"],
  },
  bn: {
    amar: ["আমার"],
    bangla: ["বাংলা"],
    bhalo: ["ভালো"],
  },
};

const suggestionCache = new Map<string, string[]>();
const MAX_CACHED_SUGGESTIONS = 500;

function transliterate(roman: string, script: string) {
  return Sanscript.t(roman, "itrans", script, { syncope: true }).replace(/\u094d$/u, "");
}

function generatedSuggestions(word: string, script: string) {
  const candidates = new Set<string>();
  const normalized = word.replace(/w/gi, (match) => match === "W" ? "V" : "v");
  const spellings = [word, normalized];
  const longVowels = normalized.replace(/aa/gi, "A").replace(/ii|ee/gi, "I").replace(/uu|oo/gi, "U");
  if (longVowels !== normalized) spellings.push(longVowels);
  const longA = normalized.replace(/a/gi, (match) => match === "A" ? "a" : "A");
  if (longA !== normalized) spellings.push(longA);

  for (const spelling of spellings) {
    const output = transliterate(spelling, script);
    if (output) candidates.add(output);
    if (candidates.size === 4) break;
  }
  return [...candidates];
}

export function getIndicTransliterationSuggestions(
  word: string,
  language: IndicLanguage,
): string[] {
  if (language === "en" || !/^[a-z]+$/i.test(word)) return [];

  const cacheKey = `${language}:${word.toLocaleLowerCase()}`;
  const cached = suggestionCache.get(cacheKey);
  if (cached) {
    suggestionCache.delete(cacheKey);
    suggestionCache.set(cacheKey, cached);
    return cached;
  }

  const common = COMMON_SUGGESTIONS[language]?.[word.toLocaleLowerCase()];
  const script = SCRIPT_BY_LANGUAGE[language];
  const suggestions = common ?? (script ? generatedSuggestions(word, script) : []);
  if (suggestions.length) {
    if (suggestionCache.size >= MAX_CACHED_SUGGESTIONS) {
      const oldestKey = suggestionCache.keys().next().value;
      if (oldestKey) suggestionCache.delete(oldestKey);
    }
    suggestionCache.set(cacheKey, suggestions);
  }
  return suggestions;
}
