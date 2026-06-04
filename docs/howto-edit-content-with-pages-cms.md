# How to edit content with Pages CMS

Edit case studies and posts from a browser, with no local checkout, and have the
changes commit to GitHub and deploy automatically. Useful for fixing copy,
swapping images, toggling `featured`/`hidden`, or writing a post from a phone.

For the config itself, see
[Pages CMS config](./reference-pages-cms-config.md). For how a commit reaches
production, see [Deploy](./howto-deploy.md).

## Prerequisites

- A GitHub account with write access to `forthrightla/jwreborn`.
- `.pages.yml` present on the branch you want to edit (it is on `master`).

## One-time setup

1. Go to [app.pagescms.org](https://app.pagescms.org) and sign in with GitHub.
2. Install the Pages CMS GitHub App and grant it access to the
   `forthrightla/jwreborn` repository (you can scope it to just that repo).
3. Open the repo in the Pages CMS dashboard. It reads `.pages.yml` and shows the
   **Case Studies** and **Writing** collections.

## Editing a case study

1. Open the **Case Studies** collection. The list shows title, client,
   featured, hidden, and date.
2. Click an entry. The form shows every frontmatter field as a labeled input:
   text fields, the tags list, date picker, the `featured`/`hidden` toggles, and
   image pickers for thumbnail, banner, and logo.
3. Edit fields. For images, the picker uploads into `public/images` and writes
   back the correct `/images/...` path automatically.
4. Save. With `merge: true` in `.pages.yml`, the change goes through a merge
   step; otherwise it commits directly to the branch.

## Editing the body (the important caveat)

The case-study **body is a raw MDX code editor, not a WYSIWYG editor.** This is
deliberate: the body contains imports and components like
`<EnhancedOutcomeGrid outcomes={[...]} />`, and a rich-text editor would corrupt
that JSX. So in the CMS the body is plain text.

What that means in practice:

- **Safe in the CMS:** editing prose, fixing typos, adjusting a stat or a list
  item, changing any frontmatter field, swapping images.
- **Do carefully in the CMS:** editing inside a component's props (the JSON-ish
  `outcomes={[...]}` blocks). It works, but there is no visual feedback and a
  broken brace fails the build.
- **Better in a code editor:** building or restructuring component-heavy layout.

Writing posts in the **Writing** collection use a normal rich-text editor, since
those bodies are plain prose.

## Creating a new entry

1. In a collection, click new entry.
2. Fill the fields. The filename is generated from the title
   (`{primary}.mdx`).
3. For a case study, remember the listing order is set in code
   (`preferredOrder` in `case-studies.astro`), so a brand-new study created in
   the CMS sorts last on the listing until that array is edited. See
   [Add a case study](./howto-add-a-case-study.md).

## Verification

- After saving, check the commit landed on GitHub (the CMS links to it).
- Netlify auto-builds on push. Watch the deploy, then confirm the live page.
- If a body edit touched component props, confirm the Netlify build succeeded;
  a malformed prop block fails the build. See [Deploy](./howto-deploy.md).

## Troubleshooting

- **The Writing collection is missing.** It only appears on a branch that has
  both `.pages.yml` and `src/content/writing/`. That content is on
  `feature/writing`, not `master`.
- **A build fails after a body edit.** The MDX has a syntax error, usually an
  unclosed component or a broken `{...}` prop. Fix it in the CMS body or in a
  local editor and recommit.
- **An image path looks wrong.** The `media.output` is `/images`, so paths
  should be `/images/...`. If you see `public/images/...` in content, the config
  drifted; check [Pages CMS config](./reference-pages-cms-config.md).
- **Edits do not appear live.** Confirm the Netlify deploy finished. The CMS
  commits; Netlify builds. The CMS does not deploy on its own.
