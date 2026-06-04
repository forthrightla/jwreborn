# Reference: Pages CMS config (`.pages.yml`)

[Pages CMS](https://pagescms.org) is a Git-based CMS: a browser UI that reads and
writes the repo's content files and commits straight back to GitHub. There is no
database and no runtime component. The site still builds and deploys exactly as
before; the CMS is only an editing surface.

`.pages.yml` at the repo root is the single source of truth for what the CMS
shows and how it maps to files. Pages CMS reads it per branch.

For the editing workflow, see
[Edit content with Pages CMS](./howto-edit-content-with-pages-cms.md). This doc
is the config itself.

## Top-level structure

```yaml
media:    # where uploads go and how their URLs are written
settings: # repo-wide behavior
content:  # the editable collections
```

## `media`

```yaml
media:
  input: public/images
  output: /images
```

- `input` is where uploaded files are written in the repo.
- `output` is the URL prefix written into content. Because the site references
  images as absolute paths (`/images/...`), `output: /images` makes the CMS
  image picker store exactly the path the templates expect.

## `settings`

```yaml
settings:
  merge: true
```

`merge: true` routes edits through a merge step rather than committing directly
to the branch. Set it to `false` to commit straight to the working branch.

## `content`

Two collections, mirroring the Astro content collections.

### `case-studies`

```yaml
- name: case-studies
  label: Case Studies
  type: collection
  path: src/content/case-studies
  filename: "{primary}.mdx"
  view:
    fields: [title, client, featured, hidden, date]
    primary: title
    sort: [date, title]
  fields: [ ... ]
```

- `path` matches the Astro collection folder.
- `filename: "{primary}.mdx"` names new files from the primary field (`title`).
- `view` controls the list screen: which columns show, the primary label, and
  sort options.

Every schema field is exposed. The mapping from Zod type to CMS field type:

| Frontmatter field | CMS field type | Notes |
|-------------------|----------------|-------|
| `title` | string | |
| `subtitle`, `seoDescription`, `highlight`, `goal`, `responsibilities` | text | multi-line |
| `client`, `duration`, `extraImage*` (width/height/alt), `accentColor`, `heroWashColor`, `password` | string | |
| `tags` | string, `list: true` | repeatable |
| `date` | date | `format: yyyy-MM-dd` |
| `featured`, `hidden`, `extraImageFullWidth`, `showHeroWash` | boolean | |
| `thumbnail`, `banner`, `logo`, `extraImage` | image | uses the `media` picker |
| `body` | **code** (`language: mdx`) | see below |

### Why `body` is `code`, not `rich-text`

Pages CMS has a `rich-text` field that gives a WYSIWYG Markdown editor. Case
study bodies are MDX: they import components and use JSX like
`<EnhancedOutcomeGrid outcomes={[...]} />`. A WYSIWYG editor does not understand
JSX and would escape or mangle it. So the body is configured as a `code` field
with `language: mdx`, which is a plain text editor that preserves the MDX
exactly. This is the one rough edge of CMS editing; the tradeoff is explained in
the [how-to](./howto-edit-content-with-pages-cms.md).

### `writing`

```yaml
- name: writing
  label: Writing
  type: collection
  path: src/content/writing
  filename: "{primary}.md"
  fields:
    - { name: title, type: string }
    - { name: date, type: date }
    - { name: description, type: text }
    - { name: heroImage, type: image }
    - { name: body, type: rich-text }
```

The `writing` body uses `rich-text` because posts are mostly prose with no
embedded components, so the WYSIWYG editor is safe and pleasant there.

> The `writing` collection lives on the `feature/writing` branch. Since Pages
> CMS reads `.pages.yml` per branch, the Writing collection only appears when
> the CMS is pointed at a branch where both the config and the content folder
> exist.

## Keeping config and schema in sync

`.pages.yml` and `src/content.config.ts` describe the same fields from two
sides. When you add or rename a frontmatter field in the Zod schema, update the
matching CMS field here, or the CMS form and the build will disagree.
