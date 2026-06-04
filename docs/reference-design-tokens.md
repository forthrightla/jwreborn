# Reference: Design tokens

The design system is a set of CSS custom properties (tokens) defined at the top
of `src/styles/main.css`. Components and pages reference tokens, not raw values.
Change a token once and it updates everywhere.

## Base font size (read this first)

`src/styles/reset.css` sets `html { font-size: 120%; }`. So `1rem = 19.2px`,
not 16px. Every `rem` value below resolves against that base. The pixel
annotations in this doc use the 19.2px base.

## Typography scale (Major Third, 1.25x)

| Token | Value | ~px | Typical use |
|-------|-------|-----|-------------|
| `--text-xs` | 0.875rem | 16.8 | small text, minimum readable |
| `--text-sm` | 1rem | 19.2 | body / h6 |
| `--text-base` | 1.25rem | 24 | large body / h5 |
| `--text-lg` | 1.5625rem | 30 | h4 |
| `--text-xl` | 1.953rem | 37.5 | h3 |
| `--text-2xl` | 2.441rem | 46.9 | h2 |
| `--text-3xl` | 3.052rem | 58.6 | h1 |
| `--text-4xl` | 3.815rem | 73.2 | hero titles |
| `--text-5xl` | 4.768rem | 91.5 | very large hero |

### Fonts

- **Body:** `"Funnel Sans"` with system sans fallbacks. Weights 300 to 800.
- **Headings:** `"IBM Plex Serif"` with Georgia fallback. Weights 400, 600, 700,
  plus 400 italic.
- Loaded from Google Fonts in the layout `<head>`.

## Spacing scale (Perfect Fourth, 2x)

| Token | Value | ~px |
|-------|-------|-----|
| `--space-2xs` | 0.25rem | 4.8 |
| `--space-xs` | 0.5rem | 9.6 |
| `--space-sm` | 0.75rem | 14.4 |
| `--space-base` | 1rem | 19.2 |
| `--space-lg` | 1.5rem | 28.8 |
| `--space-xl` | 2rem | 38.4 |
| `--space-2xl` | 3rem | 57.6 |
| `--space-3xl` | 4rem | 76.8 |

## Color

Colors are defined as a raw palette, then mapped to semantic tokens. Components
should use the semantic tokens so dark mode works automatically.

### Palette (selected)

| Token | Value |
|-------|-------|
| `--blue-500` | `#2E3A59` (primary) |
| `--blue-700` | `#1C2339` |
| `--pink-500` | `#f93b6b` (accent) |
| `--gray-200` | `#e4e7eb` (border) |
| `--gray-600` | `#49535a` (muted text) |
| `--gray-800` | `#272c30` (text) |

### Semantic tokens

| Token | Light | Maps to |
|-------|-------|---------|
| `--color-bg` | `#ffffff` | page background |
| `--color-surface` | `var(--gray-50)` | inputs, rare chips |
| `--color-text` | `var(--gray-800)` | body text |
| `--color-text-muted` | `var(--gray-600)` | secondary text |
| `--color-border` | `var(--gray-200)` | borders |
| `--color-primary` | `var(--blue-500)` | brand |
| `--color-accent` | `var(--pink-500)` | accent |

Dark mode (`[data-theme="dark"]`) overrides the semantic tokens with a charcoal
palette. Guidance baked into the system: prefer transparent panels with a
`1px solid var(--color-border)` over filled surfaces, and reserve
`--color-surface` for inputs.

## Shadows

| Token | Value |
|-------|-------|
| `--shadow-xs` | `0 1px 3px rgba(0,0,0,0.04)` |
| `--shadow-sm` | `0 2px 8px rgba(0,0,0,0.06)` |
| `--shadow-md` | `0 4px 16px rgba(0,0,0,0.08)` |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.10)` |
| `--shadow-xl` | `0 12px 32px rgba(0,0,0,0.12)` |
| `--shadow-inset` | `inset 0 1px 2px rgba(0,0,0,0.05)` |

## Radius

| Token | Value |
|-------|-------|
| `--radius-sm` | 6px |
| `--radius-md` | 12px |
| `--radius-lg` | 16px |
| `--radius-xl` | 24px |
| `--radius-full` | 9999px |

## Transitions and interaction

| Token | Value |
|-------|-------|
| `--transition-fast` | 0.15s ease |
| `--transition-normal` | 0.3s ease |
| `--transition-slow` | 0.5s ease |
| `--hover-lift` | -4px |
| `--hover-scale` | 1.02 |

## Responsive breakpoints

Used throughout `main.css` and component styles:

- Mobile: `<= 480px`
- Tablet: `<= 768px`
- Desktop: `> 768px`
- Wide: `> 1024px`

## Layout widths

- Outer gutter: `4vw`
- Max content width: `1140px`
- Narrow content width: `960px`
