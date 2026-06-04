# Architecture

This explains how joshux.com is put together and why. It assumes you have read
none of the code. For exact field names and props, follow the links to the
reference docs.

## What the site is

A personal UX portfolio: a homepage, a case-studies listing, and one page per
case study. It is a static site. Every page is rendered to plain HTML at build
time and served as files. There is no server, no database, and no API at
runtime. The only client-side JavaScript is the mobile nav, the dark-mode
toggle, the fake password gate, and a lazily-loaded video player.

That choice is the spine of everything else. Static output means the host is
just a CDN, deploys are atomic, and the whole site survives with zero moving
parts. The cost is that anything dynamic has to happen either at build time or
in a little inline script.

## The stack

- **Astro 6** is the framework. It renders components to HTML at build time and
  ships almost no JavaScript by default.
- **MDX** (`@astrojs/mdx`) is the content format for case studies. MDX is
  Markdown that can import and render components, so a case study can drop a
  stats grid or a video inline between paragraphs of prose.
- **Plain CSS** with custom properties. No Tailwind, no CSS modules. Global
  styles live in `src/styles/`, design decisions live in tokens. See
  [Design tokens](./reference-design-tokens.md).
- **@astrojs/sitemap** generates `sitemap-index.xml` at build.
- **Netlify** hosts the static output. See [Deploy](./howto-deploy.md).
- **Pages CMS** is the optional browser editor, configured by `.pages.yml`. See
  [Edit content with Pages CMS](./howto-edit-content-with-pages-cms.md).

## How content becomes pages

Content lives as files, not database rows. This is Astro's Content Layer API.

```
src/content/case-studies/*.mdx   ──┐
                                   ├─ getCollection('case-studies')
src/content.config.ts (schema)   ──┘        │
                                            ▼
                          src/pages/work/[slug].astro
                                            │
                                            ▼
                          /work/<filename-without-ext>/  (static HTML)
```

1. `src/content.config.ts` defines two collections, `case-studies` and
   `writing`, each with a Zod schema. The schema validates frontmatter at build
   time. A typo in a field name or a missing required field fails the build
   instead of shipping a broken page. Full field list:
   [Content schema](./reference-content-schema.md).
2. The loader is `glob()`, so a collection is just a folder of files matched by
   pattern. Adding a file adds an entry. No registry to update.
3. The entry `id` is the filename without extension. `rewind-case-study.mdx`
   becomes the route `/work/rewind-case-study/`.
4. `src/pages/work/[slug].astro` calls `getStaticPaths()` to enumerate every
   case study and generate one page each.

### Why MDX plus components

A case study is long-form and visual. Pure Markdown cannot express a four-up
outcome grid or a Mux video. Pure Astro components would mean writing prose
inside JSX, which is miserable. MDX is the middle: prose stays prose, and the
heavy visual pieces are components imported at the top of the file and used
inline. See [Components](./reference-components.md) for the full set, and
[Add a case study](./howto-add-a-case-study.md) for the authoring pattern.

This is also the one real friction point with Pages CMS: the CMS form edits
frontmatter cleanly, but the MDX body holds JSX it cannot render visually, so
the body is edited as raw code. That tradeoff is covered in the
[Pages CMS how-to](./howto-edit-content-with-pages-cms.md).

## Pages and routing

| Route | Source | Notes |
|-------|--------|-------|
| `/` | `src/pages/index.astro` | Hero, methodology, testimonial, featured studies, about. Pulls copy from `src/data/homepage.json`. |
| `/case-studies` | `src/pages/case-studies.astro` | Lists every visible study as a `SimplifiedCard`, in a hand-set `preferredOrder`. |
| `/work/<slug>` | `src/pages/work/[slug].astro` | One per case study via `getStaticPaths()`. |
| `/404` | `src/pages/404.astro` | Not-found page. |
| `/robots.txt` | `src/pages/robots.txt.ts` | Generated endpoint; disallows the resume PDF, points to the sitemap. |

Three filters shape what gets built and listed:

- **`hidden: true`** in frontmatter drops a study from the homepage and the
  listing, and sets `noindex` on its page. The page still builds and is
  reachable by URL.
- **`*.bak.mdx`** files are skipped everywhere, including `getStaticPaths()`, so
  a backup copy never becomes a live page.
- **The makerspace study** is excluded from the sitemap in `astro.config.mjs`,
  so it builds and is reachable but is not advertised to search engines.

## The layout and the page shell

Every page wraps its content in `src/layouts/Layout.astro`. The layout owns the
`<head>`: meta description, Open Graph and Twitter cards, favicons, fonts,
canonical URL, the dark-mode boot script, and Microsoft Clarity analytics. Pages
pass it props like `title`, `description`, `image`, and `noindex`. See the
Layout entry in [Components](./reference-components.md#layout-and-chrome).

### SEO and structured data

SEO is handled in two layers, both in the layout:

1. **Always-on site identity.** The layout emits one `Person` JSON-LD block on
   every page describing Josh, plus the standard meta and social tags.
2. **Per-page structured data.** A page can pass a `structuredData` prop and the
   layout renders it as a second JSON-LD block. Case-study pages build a
   `CreativeWork` object (headline, description, image, author, keywords) in
   `work/[slug].astro`. The page description and social image fall back in
   order: `seoDescription`, then `subtitle`, then `highlight`, then `title`;
   image prefers `banner`, then `thumbnail`.

The `seoDescription` field exists specifically so search and social text can be
tuned without changing the human-facing `subtitle`.

## Theming

Dark mode is a `data-theme` attribute on `<html>`. An inline script in the
layout reads `localStorage.theme` (falling back to the OS preference) and sets
the attribute before first paint, which avoids a flash of the wrong theme. The
Navbar toggle writes the attribute and persists it. Every color is a token with
a light and dark value, so components never hardcode a color. See
[Design tokens](./reference-design-tokens.md).

## What is deliberately fake

The password gate on confidential case studies never validates anything. It is a
UX boundary plus a contact prompt, and the protected body is simply not rendered
into the HTML at build. Full reasoning:
[Password protection](./explanation-password-protection.md).
