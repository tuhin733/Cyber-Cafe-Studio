/** @type {import('tailwindcss').Config} */
const themedColor = (role) =>
  `color-mix(in srgb, var(--theme-${role}) calc(<alpha-value> * 100%), transparent)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: themedColor('surface'), muted: themedColor('surface-muted'), subtle: themedColor('surface-subtle') },
        ink: {
          primary: themedColor('ink-primary'),
          strong: themedColor('ink-strong'),
          secondary: themedColor('ink-secondary'),
          muted: themedColor('ink-muted'),
          faint: themedColor('ink-faint'),
          disabled: themedColor('ink-disabled'),
          inverse: themedColor('ink-inverse'),
        },
        ui: { DEFAULT: themedColor('ui-border'), strong: themedColor('ui-border-strong'), subtle: themedColor('ui-border-subtle') },
        action: {
          DEFAULT: themedColor('action'),
          hover: themedColor('action-hover'),
          active: themedColor('action-active'),
          emphasis: themedColor('action-emphasis'),
          accent: themedColor('action-accent'),
          subtle: themedColor('action-subtle'),
          soft: themedColor('action-soft'),
          border: themedColor('action-border'),
          'border-strong': themedColor('action-border-strong'),
          outline: themedColor('action-outline'),
          secondary: themedColor('action-secondary'),
        },
        danger: {
          DEFAULT: themedColor('danger'),
          strong: themedColor('danger-strong'),
          subtle: themedColor('danger-subtle'),
          soft: themedColor('danger-soft'),
          border: themedColor('danger-border'),
        },
        error: {
          DEFAULT: themedColor('error'),
          hover: themedColor('error-hover'),
          outline: themedColor('error-outline'),
          subtle: themedColor('error-subtle'),
          soft: themedColor('error-soft'),
        },
        success: {
          DEFAULT: themedColor('success'),
          strong: themedColor('success-strong'),
          accent: themedColor('success-accent'),
          progress: themedColor('success-progress'),
          subtle: themedColor('success-subtle'),
          soft: themedColor('success-soft'),
          border: themedColor('success-border'),
        },
        warning: {
          DEFAULT: themedColor('warning'),
          strong: themedColor('warning-strong'),
          subtle: themedColor('warning-subtle'),
          soft: themedColor('warning-soft'),
          border: themedColor('warning-border'),
        },
        overlay: themedColor('overlay'),
        preview: { DEFAULT: themedColor('preview'), muted: themedColor('preview-muted') },
        checker: { light: themedColor('checker-light'), dark: themedColor('checker-dark') },
      },
    },
  },
  plugins: [],
};
