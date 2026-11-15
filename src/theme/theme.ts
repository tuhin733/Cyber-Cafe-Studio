export const PHOTO_BACKGROUND_COLORS = {
  white: "#FFFFFF",
  offwhite: "#F8F8F0",
  lightBlue: "#ADD8E6",
  skyBlue: "#87CEEB",
  deepSkyBlue: "#00BFFF",
  lightGrey: "#D3D3D3",
  veryLightGrey: "#F2F2F2",
  lightPink: "#FFB6C1",
  cream: "#FFFDD0",
} as const;

const THEME_COLOR_VARIABLES = {
  "ink-strong": "--theme-ink-strong",
  "ink-inverse": "--theme-ink-inverse",
  "surface-subtle": "--theme-surface-subtle",
  preview: "--theme-preview",
  "image-output-background": "--theme-image-output-background",
  "action-emphasis": "--theme-action-emphasis",
} as const;

type ThemeColor = keyof typeof THEME_COLOR_VARIABLES;

export function getThemeColor(color: ThemeColor, alpha = 1): string {
  const channels = getComputedStyle(document.documentElement)
    .getPropertyValue(THEME_COLOR_VARIABLES[color])
    .trim();

  if (!channels) {
    throw new Error(`Theme color "${color}" is not defined.`);
  }

  if (alpha === 1) return channels;

  return `color-mix(in srgb, ${channels} ${alpha * 100}%, transparent)`;
}
