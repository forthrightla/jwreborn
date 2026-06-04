# How to add a case study

Create a new case study that builds into a page at `/work/<slug>/` and appears
on the listing page. This assumes the dev server runs (see
[Getting started](./tutorial-getting-started.md)).

## Prerequisites

- The repo cloned and `npm install` done.
- Images for the study exported and ready (thumbnail, optional banner, any inline
  images).

## Steps

1. **Add the images.** Put files in `public/images/`. They are referenced by
   absolute path, so a file at `public/images/block-acme.png` is referenced as
   `/images/block-acme.png`. There is no import step.

2. **Create the MDX file.** The filename becomes the URL slug. For
   `/work/acme-case-study/`, create
   `src/content/case-studies/acme-case-study.mdx`.

3. **Write the frontmatter.** Required fields are `title`, `thumbnail`, and
   `tags`. Full list: [Content schema](./reference-content-schema.md).

   ```mdx
   ---
   title: "A specific, outcome-led case study title"
   subtitle: "One line describing the project."
   seoDescription: "Search/social description, tuned for keywords."
   thumbnail: "/images/block-acme.png"
   banner: "/images/case-studies/banner-acme.png"
   tags: ["Product Strategy"]
   client: "Acme"
   featured: false
   goal: "What the project set out to do"
   responsibilities: "Your role"
   duration: "8 weeks"
   ---
   ```

4. **Import any components you need**, at the top of the body:

   ```mdx
   import EnhancedOutcomeGrid from '../../components/layouts/EnhancedOutcomeGrid.astro';
   import FeaturedQuote from '../../components/FeaturedQuote.astro';
   import ResponsiveImage from '../../components/ResponsiveImage.astro';
   ```

   Note the `../../` path: MDX files are two folders deep, under
   `src/content/case-studies/`. See [Components](./reference-components.md) for
   every component and its props.

5. **Write the body.** Mix Markdown prose with components:

   ```mdx
   ## Summary

   - **Problem:** ...
   - **Outcome:** ...

   <EnhancedOutcomeGrid
     outcomes={[
       { stat: "+29%", description: "positive responses", colorClass: "accent" },
       { stat: "8 wks", description: "concept to launch", colorClass: "primary" },
     ]}
     columns={2}
   />

   More prose here.
   ```

6. **Set the listing position.** The listing order is a hand-set array, not
   automatic. Add the slug to `preferredOrder` in
   `src/pages/case-studies.astro` where you want it. Slugs not in the array sort
   last.

## Verification

- The dev server hot-reloads. Open `http://localhost:4321/work/acme-case-study/`
  and confirm the page renders.
- Open `http://localhost:4321/case-studies` and confirm the card shows in the
  right position.
- Run a production build to catch schema errors:

  ```bash
  npm run build
  ```

  A frontmatter typo or a missing required field fails the build with the field
  name. Fix it and rebuild.

## Troubleshooting

- **Build fails with a Zod / schema error.** A frontmatter field is missing,
  misspelled, or the wrong type. Check it against
  [Content schema](./reference-content-schema.md). Dates must be `YYYY-MM-DD`.
- **An image 404s.** The path must be absolute from the site root and the file
  must be under `public/`. `/images/x.png` maps to `public/images/x.png`.
- **A component throws "is not defined".** It was used in the body but not
  imported at the top, or the import path is wrong (`../../components/...`).
- **The client logo does not show.** `client` must exactly match a recognized
  value in `ClientLogo.astro`. See [Components](./reference-components.md#clientlogoastro).
- **The page should be private.** Set `password` to withhold the body, and
  `hidden: true` to also drop it from listings and search. See
  [Password protection](./explanation-password-protection.md).
- **Keeping a draft in the folder without publishing it.** Name it `*.bak.mdx`.
  Those files are skipped from listings and route generation.
