# Tutorial: Getting started

By the end of this you will have the site running on your machine and will have
made a visible edit with live reload. It takes a few minutes and assumes you
have Node.js and Git installed.

## What you'll need

- Node.js 18+ and npm.
- Git, with access to `github.com/forthrightla/jwreborn`.

## Step 1: Clone and install

```bash
git clone https://github.com/forthrightla/jwreborn.git
cd jwreborn
npm install
```

`npm install` pulls a small dependency set: Astro, the MDX integration, and the
sitemap integration. There is nothing else to configure.

## Step 2: Start the dev server

```bash
npm run dev
```

Astro prints a local URL, usually `http://localhost:4321`. Open it. You should
see the homepage with the hero line, the methodology section, a testimonial, the
featured case studies, and the about section.

That is the working site, three steps in.

## Step 3: Make a visible edit

The homepage hero text comes from a data file, not from markup. Open
`src/data/homepage.json` and change `heroTitle`:

```json
{
  "heroTitle": "Your edited hero line here.",
  ...
}
```

Save. The browser hot-reloads and the hero updates immediately. You just changed
content without touching a component. Revert it when you are done.

## Step 4: Open a case study page

Visit `http://localhost:4321/work/rewind-case-study/`. This page was generated
from `src/content/case-studies/rewind-case-study.mdx`. Open that file and notice
two parts:

- **Frontmatter** at the top (between the `---` lines): title, images, tags, and
  project metadata. These are validated against a schema at build time.
- **Body**: Markdown prose mixed with components like `<EnhancedOutcomeGrid />`
  that are imported at the top of the file.

Change a word in the prose, save, and watch it reload.

## What you built

You have the full site running locally with live reload, and you have edited
both a data file and a case study. From here:

- To add your own case study, follow
  [Add a case study](./howto-add-a-case-study.md).
- To understand how files become pages, read
  [Architecture](./explanation-architecture.md).
- To see every component you can drop into a case study, see
  [Components](./reference-components.md).
- To edit content without a local checkout, see
  [Edit content with Pages CMS](./howto-edit-content-with-pages-cms.md).

## Common issues

- **`npm run dev` fails on an old Node.** Astro 6 needs Node 18+. Check
  `node --version`.
- **Port 4321 in use.** Astro will pick another port and print it; use the URL
  it shows.
- **A change does not appear.** Confirm you saved, and that you edited a file
  under `src/`. Files in `dist/` are build output and are overwritten.
