# joshux.com documentation

Documentation for Josh Wright's portfolio site, organized by the
[Diataxis](https://diataxis.fr) framework. Each document serves one reader mode:
learning, doing, looking up, or understanding.

## Start here

New to the codebase? Read [Tutorial: Getting started](./tutorial-getting-started.md),
then skim [Explanation: Architecture](./explanation-architecture.md).

## Tutorials (learning-oriented)

| Doc | What you get |
|-----|--------------|
| [Getting started](./tutorial-getting-started.md) | Clone, run the dev server, and make your first edit |

## How-to guides (task-oriented)

| Doc | Task |
|-----|------|
| [Add a case study](./howto-add-a-case-study.md) | Create a new case study from frontmatter to published page |
| [Edit content with Pages CMS](./howto-edit-content-with-pages-cms.md) | Edit case studies and posts from a browser, no local setup |
| [Deploy and manage redirects](./howto-deploy.md) | How a push reaches production, and how to add a redirect |

## Reference (information-oriented)

| Doc | Covers |
|-----|--------|
| [Content schema](./reference-content-schema.md) | Every frontmatter field for `case-studies` and `writing` |
| [Components](./reference-components.md) | All 18 components and their props |
| [Design tokens](./reference-design-tokens.md) | CSS custom properties: type, spacing, color, shadow |
| [Pages CMS config](./reference-pages-cms-config.md) | The `.pages.yml` field-by-field |

## Explanation (understanding-oriented)

| Doc | Question it answers |
|-----|---------------------|
| [Architecture](./explanation-architecture.md) | Why Astro, static output, content collections, and how SEO is wired |
| [Password protection](./explanation-password-protection.md) | Why the password gate never validates, and what it actually protects |

## A note on older docs

`ProjectConstraints.md` in the repo root predates several changes. Where it
disagrees with the docs here, these docs are correct. Known stale points:
Decap CMS (never shipped; Pages CMS is the CMS now), the base font size, and
the brand color hex values.
