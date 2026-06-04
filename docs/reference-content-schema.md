# Reference: Content schema

The two content collections and every frontmatter field they accept. The source
of truth is `src/content.config.ts`, which validates frontmatter with Zod at
build time. A field not listed here is not in the schema, and using it will fail
the build (or be ignored, depending on Astro's strictness).

Collections use the `glob()` loader. The entry `id` is the filename without its
extension, and that `id` is the URL slug.

---

## Collection: `case-studies`

- **Location:** `src/content/case-studies/`
- **Pattern:** `**/*.mdx`
- **Route:** `/work/<id>/`

| Field | Type | Required | Default | Purpose |
|-------|------|----------|---------|---------|
| `title` | string | yes | | Page title and card heading |
| `subtitle` | string | no | | Short human-facing tagline under the title |
| `seoDescription` | string | no | | Meta/social description; overrides `subtitle` for SEO only |
| `thumbnail` | string | yes | | Card image path, e.g. `/images/block-rewind.png` |
| `banner` | string | no | | Hero image; also preferred as the social share image |
| `tags` | string[] | yes | | Category labels, e.g. `["0 → 1 Product Strategy"]` |
| `date` | date | no | | Publication date (`YYYY-MM-DD`) |
| `featured` | boolean | no | `false` | Eligible for homepage featured slots |
| `hidden` | boolean | no | `false` | Hide from listings and set `noindex` (still builds) |
| `password` | string | no | | Marks the study confidential; see note below |
| `highlight` | string | no | | Card highlight line on the listing page |
| `logo` | string | no | | Client logo image path |
| `client` | string | no | | Client name; also drives `ClientLogo` SVG selection |
| `extraImage` | string | no | | Secondary hero image |
| `extraImageAlt` | string | no | | Alt text for `extraImage` |
| `extraImageHeight` | string | no | | CSS height for `extraImage` |
| `extraImageWidth` | string | no | | CSS width for `extraImage` |
| `extraImageFullWidth` | boolean | no | | Render `extraImage` full-bleed |
| `goal` | string | no | | Project metadata (ProjectDetails) |
| `responsibilities` | string | no | | Project metadata (ProjectDetails) |
| `duration` | string | no | | Project metadata (ProjectDetails) |
| `accentColor` | string | no | | Per-study accent (hex) |
| `heroWashColor` | string | no | | Hero wash color (RGB values) |
| `showHeroWash` | boolean | no | | Toggle the hero color wash |

### Notes

- **Image paths are absolute from the site root.** Images live in `public/` and
  are referenced as `/images/...`. They are not imported.
- **`password` does not encrypt or gate logins.** Setting it marks a study
  confidential: the body is not rendered into the page and a contact form is
  shown instead. See [Password protection](./explanation-password-protection.md).
- **`client` value must match a `ClientLogo` case** to render a logo. Known
  values: `Indeed`, `LegalZoom`, `AXS`, `Cerebral`, `Rewind`, `Make:`,
  `O'Reilly Auto Parts`, `USA Jump Rope`. Any other value renders no logo.
- **`tags` drives nothing structural** beyond display and the per-page
  `keywords`. The listing order is a hand-set array in
  `case-studies.astro`, not tag-based.

### Minimal example

```mdx
---
title: "A short, specific case study title"
subtitle: "One line on what this project was."
thumbnail: "/images/block-example.png"
tags: ["UX Design"]
client: "Indeed"
---

import EnhancedOutcomeGrid from '../../components/layouts/EnhancedOutcomeGrid.astro';

## Summary

Prose goes here.
```

---

## Collection: `writing`

- **Location:** `src/content/writing/`
- **Pattern:** `**/*.{md,mdx}`
- **Status:** lives on the `feature/writing` branch, not yet on `master`.

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `title` | string | yes | Post title |
| `date` | date | yes | Publication date (`YYYY-MM-DD`) |
| `description` | string | yes | Card and preview text |
| `heroImage` | string | no | Optional hero image path |

Writing posts are mostly prose, so unlike case studies their body maps cleanly
to a rich-text editor in Pages CMS.

---

## Reading collections in code

```astro
---
import { getCollection } from 'astro:content';
const studies = await getCollection('case-studies');
// studies[n].id    -> slug (filename without extension)
// studies[n].data  -> validated frontmatter (the table above)
// studies[n].body  -> raw MDX source
---
```

To render a single entry's body:

```astro
---
import { render } from 'astro:content';
const { Content } = await render(entry);
---
<Content />
```

> Note: `src/types/index.ts` has hand-written interfaces that overlap this
> schema (`CaseStudyData`) but are not the source of truth and have drifted in
> places. Trust `content.config.ts`.
