declare module "indic-transliterator" {
  export function getSuggestions(word: string, script?: string): string[];
  export function transliterate(text: string, script?: string): string;
}
