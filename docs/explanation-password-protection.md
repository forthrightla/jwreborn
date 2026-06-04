# Password protection

Some case studies cover confidential client work. The site has a password gate
for them. The gate never validates a password and never unlocks anything. This
explains why that is the right design here, and what it does and does not
protect.

## The problem

A static site has no server and no session. There is nowhere to safely check a
password, and nothing to gate access with. Anything shipped to the browser is
public: client-side password checks are trivially bypassed by reading the page
source. So a "real" password on a static portfolio is theater that also gives a
false sense of security.

At the same time, there is a genuine need: show that confidential work exists,
keep its details off the public internet, and give the right people a way to ask
for access.

## The approach

Two moving parts, in `src/pages/work/[slug].astro`.

1. **The body is withheld at build time.** When a study has a `password` field,
   the page renders a contact form instead of the MDX body. The protected
   content is never written into the generated HTML, so there is nothing to dig
   out of the page source. This is the part that actually protects the work.

2. **The form is a deliberate dead end.** The submit handler validates only that
   the input is non-empty and at least 4 characters, then waits 1200ms to
   simulate a server check, then always shows "Incorrect password." There is no
   correct password. The error invites the visitor to email for access.

```
password set?
   ├─ no  → render the MDX <Content />
   └─ yes → render the password form (body never emitted)
                 │
            submit → 1200ms delay → always "Incorrect password" + contact prompt
```

## What it protects, and what it does not

- **Protected:** the case study's body. It is not in the HTML, so it cannot be
  viewed, scraped, or indexed.
- **Not protected, by design:** the study's existence and its card metadata.
  `title`, `thumbnail`, `client`, and `tags` still appear in listings unless the
  study is also marked `hidden`. The point is to advertise that the work exists
  while keeping the details private.

If you want a study fully out of sight, combine `password` with `hidden: true`.
`hidden` removes it from the homepage and the listing and adds `noindex`. See
[Content schema](./reference-content-schema.md).

## Trade-offs

- **No real access path.** Even the right person cannot read a protected study
  on the site; the only "unlock" is to email Josh, who shares the work directly.
  That is intentional. The alternative, a real auth system, is not worth a
  backend on a static portfolio.
- **The fake delay is a small honesty cost.** It mimics a server round-trip so
  the gate feels real. A visitor who reads the source will see it always fails.
  That is acceptable: the protection is the withheld body, not the form.

## If a real gate were ever needed

It would require leaving the static-only model: an edge function or auth
provider to check credentials and serve the body conditionally. That is a
different architecture (see [Architecture](./explanation-architecture.md)) and
has not been needed. The current design gets the real benefit, keeping
confidential prose off the public web, without any of that cost.
