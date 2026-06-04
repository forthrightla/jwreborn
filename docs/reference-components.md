# Reference: Components

Every component in `src/components/`, with its props. Props are pulled from each
component's own `interface`. Where `src/types/index.ts` disagrees, the component
file wins (the shared types have drifted in a few places, flagged below).

Required props have no default. Optional props show their default if the
component sets one.

Components are used two ways: inside `.astro` pages, and inside `.mdx` case
studies (imported at the top of the file, then used as JSX). See
[Add a case study](./howto-add-a-case-study.md).

---

## Cards

### `Card.astro`
Rich featured card with thumbnail, tags, and optional secondary image.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `href` | string | | Link target (required) |
| `title` | string | | (required) |
| `img` | string | | Thumbnail path (required) |
| `isPasswordProtected` | boolean | `false` | Shows a lock affordance |
| `tags` | string[] | `[]` | |
| `highlight` | string | | Falls back to `subtitle`, then `title` |
| `subtitle` | string | | |
| `client` | string | | |
| `extraImage` | string | | |
| `extraImageAlt` | string | | |
| `extraImageHeight` | string | | |
| `extraImageWidth` | string | | |
| `extraImageFullWidth` | boolean | `false` | |
| `hideThumbnail` | boolean | `false` | |

### `SimplifiedCard.astro`
Minimal grid card. Used on `/case-studies`. Extends `CardProps`.

| Prop | Type | Notes |
|------|------|-------|
| `href` | string | required |
| `title` | string | required |
| `img` | string | required |
| `client` | string | optional |
| `highlight` | string | optional |

---

## Typography and quotes

### `FeaturedQuote.astro`
Full-width pull quote with attribution.

| Prop | Type |
|------|------|
| `quote` | string |
| `authorName` | string |
| `authorTitle` | string |
| `authorImage` | string |

### `Testimonial.astro`
Single quote block with portrait.

| Prop | Type | Notes |
|------|------|-------|
| `name` | string | |
| `title` | string | optional |
| `portrait` | string | |
| `quote` | string | |

### `TestimonialsSection.astro`
Section wrapper around multiple testimonials.

| Prop | Type | Default |
|------|------|---------|
| `testimonials` | Testimonial[] | |
| `title` | string | `"Kind words from colleagues"` |
| `id` | string | `"testimonials"` |

---

## Media

### `ResponsiveImage.astro`
AVIF/WebP-friendly image with an optional separate mobile source.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `src` | string | | Desktop image (required) |
| `mobileSrc` | string | | Swap below the mobile breakpoint |
| `alt` | string | | (required) |
| `maxHeight` | string | | CSS max-height |
| `maxHeightMobile` | string | | CSS max-height on mobile |
| `contain` | boolean | | Use `object-fit: contain` |
| `priority` | boolean | | Eager-load (above the fold) |

### `Video.astro`
Mux player embed. The Mux script is loaded lazily by the layout only when a
`<mux-player>` is present on the page.

| Prop | Type | Notes |
|------|------|-------|
| `playbackId` | string | Mux playback ID (required) |
| `title` | string | optional |
| `accentColor` | string | optional player accent |
| `thumbnail` | string | optional poster |

---

## Content formatting

### `StyledBulletList.astro`
Custom bullet list, optionally multi-column.

| Prop | Type | Default |
|------|------|---------|
| `items` | `{ text: string; emphasis?: 'primary' \| 'muted' }[]` | |
| `columns` | `1 \| 2 \| 3` | |

### `Table.astro`
Data table.

| Prop | Type | Default |
|------|------|---------|
| `headers` | string[] | |
| `data` | `(string \| number)[][]` | |
| `variant` | `'default' \| 'compact' \| 'striped'` | `'default'` |

> The prop is `data`, not `rows`. `src/types/index.ts` (`TableProps`) says
> `rows` and is stale.

### `ConversationExchange.astro`
Chat-style dialog for interviews or stakeholder exchanges.

| Prop | Type |
|------|------|
| `title` | string |
| `intro` | string |
| `exchanges` | `{ speaker: 'stakeholder' \| 'me'; avatar: string; label: string; message: string }[]` |
| `outcome` | string |

### `ParticipantInsights.astro`
Research participant profiles plus a synthesized insight and recommendation.

| Prop | Type |
|------|------|
| `theme` | string |
| `participants` | `{ name: string; avatar: string; description: string }[]` |
| `insight` | string |
| `context` | string |
| `recommendationTitle` | string |
| `recommendation` | string |

### `BoxesAndArrows.astro`
Process-flow diagram of labeled steps.

| Prop | Type | Default |
|------|------|---------|
| `steps` | `{ text: string; subtext?: string; variant?: 'default' \| 'problem' \| 'solution' \| 'threshold' \| 'muted'; zone?: string }[]` | |
| `className` | string | `''` |

---

## Outcomes

### `EnhancedOutcomeCard.astro`
Single stat or text card.

| Prop | Type | Default |
|------|------|---------|
| `stat` | string | |
| `description` | string | |
| `colorClass` | `'primary' \| 'secondary' \| 'accent' \| 'muted'` | |
| `variant` | `'with-stat' \| 'text-only'` | |
| `shimmer` | boolean | |

### `layouts/EnhancedOutcomeGrid.astro`
Responsive grid of outcome cards. The common way to show results.

| Prop | Type | Default |
|------|------|---------|
| `outcomes` | `Outcome[]` (same shape as the card above) | |
| `columns` | `2 \| 3 \| 4 \| 6 \| 'auto'` | |
| `animateOnScroll` | boolean | |

Example (as used in MDX):

```mdx
<EnhancedOutcomeGrid
  outcomes={[
    { stat: "10 wks", description: "concept to App Store", colorClass: "primary" },
    { stat: "+29%", description: "positive candidate responses", colorClass: "accent" },
  ]}
  columns={2}
/>
```

---

## Layout and chrome

### `Navbar.astro`
Sticky site header with mobile slide-out menu and dark-mode toggle.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `current` | string | | Marks the active nav item, e.g. `"case-studies"` |
| `useSvgLogo` | boolean | `false` | Use the SVG wordmark instead of text |

### `ProjectDetails.astro`
Three-column metadata grid.

| Prop | Type |
|------|------|
| `goal` | string |
| `responsibilities` | string |
| `duration` | string |

### `Skill.astro`
Methodology item with an animated icon. Used on the homepage.

| Prop | Type | Notes |
|------|------|-------|
| `title` | string | |
| `description` | string | |
| `img` | string | optional raster icon |
| `svg` | string | optional inline SVG markup |

### `ClientLogo.astro`
Renders an inline client logo SVG selected by name.

| Prop | Type |
|------|------|
| `client` | string |

Recognized `client` values: `Indeed`, `LegalZoom`, `AXS`, `Cerebral`,
`Rewind`, `Make:`, `O'Reilly Auto Parts`, `USA Jump Rope`. Any other value
renders nothing.

### `layouts/Layout.astro`
The page shell. Owns `<head>`, the Navbar, the footer, the dark-mode boot
script, analytics, and the default `Person` JSON-LD. See
[Architecture](./explanation-architecture.md#seo-and-structured-data).

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `title` | string | | `<title>` and OG/Twitter title (required) |
| `currentNav` | string | | Passed to Navbar `current` |
| `description` | string | | Falls back to a site default |
| `image` | string | | Social image; falls back to `/images/banner-portraits.png` |
| `type` | `'website' \| 'article'` | `'website'` | OG type |
| `useSvgLogo` | boolean | `true` | Passed to Navbar |
| `noindex` | boolean | `false` | Emits `noindex, nofollow` |
| `structuredData` | object \| object[] | | Extra JSON-LD rendered into `<head>` |
