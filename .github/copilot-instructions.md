# Project Guidelines

## UI Color System

- For new or modified UI, use semantic color roles defined in `src/theme/theme.css` through the semantic Tailwind colors in `tailwind.config.js` (for example, `bg-surface`, `text-ink-primary`, `border-ui`, `bg-action`, and `text-danger`).
- Prefer an existing semantic role over a shade name or a hardcoded color. If a new UI color role is needed, add a named hex token to `src/theme/theme.css` and expose it in `tailwind.config.js`.
- For CSS, SVG, or canvas colors, reference the semantic CSS variables from `src/theme/theme.css`; use `getThemeColor` from `src/theme/theme.ts` when canvas APIs need a resolved color value.
- Keep intentional content colors—such as user-selectable photo backgrounds, generated image colors, and fixed brand artwork—separate from app UI roles unless the design explicitly requires them to be themeable.

## Reusable UI Components

- When adding UI or features, check for repeated structures and behavior already used in the project. If a pattern appears in multiple places and can be shared without obscuring meaningful differences, extract or reuse a component instead of duplicating it.
- Keep genuinely different interactions and semantics explicit; do not create abstractions solely to reduce line count.
