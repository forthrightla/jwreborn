# Codebase Reference - joshux.com

## Project Overview
Personal portfolio site built with **Astro 6.1.9**, featuring case studies and testimonials. Site URL: https://joshux.com

## Tech Stack
- **Framework:** Astro 6.1.9
- **Content:** MDX via `@astrojs/mdx` 5.0.4
- **Styling:** Pure CSS custom properties (no Tailwind/CSS modules)
- **Analytics:** Microsoft Clarity
- **Deployment:** Netlify (static)

---

## Project Structure
```
src/
├── components/           # 18 Astro components
│   ├── Card.astro              # Rich featured card
│   ├── SimplifiedCard.astro    # Minimal grid card
│   ├── Navbar.astro            # Site header + mobile menu
│   ├── Testimonial.astro       # Single quote block
│   ├── TestimonialsSection.astro
│   ├── FeaturedQuote.astro     # Full-width pull quote
│   ├── Skill.astro             # Skill with animated icon
│   ├── ProjectDetails.astro    # 3-col metadata grid
│   ├── EnhancedOutcomeCard.astro
│   ├── ResponsiveImage.astro   # AVIF/WebP smart image
│   ├── Video.astro             # Mux player embed
│   ├── Table.astro             # Data table
│   ├── ConversationExchange.astro  # Chat-style dialog
│   ├── ParticipantInsights.astro   # Research insights
│   ├── StyledBulletList.astro      # Custom bullet list
│   ├── BoxesAndArrows.astro        # Process flow diagram
│   ├── ClientLogo.astro            # SVG client logos
│   └── layouts/
│       └── EnhancedOutcomeGrid.astro
├── layouts/
│   └── Layout.astro          # Main page wrapper
├── pages/
│   ├── index.astro           # Homepage
│   ├── case-studies.astro    # Case studies listing
│   ├── work/[slug].astro     # Dynamic case study pages
│   ├── 404.astro
│   └── robots.txt.ts
├── content/
│   └── case-studies/         # 7 MDX case study files
├── styles/
│   ├── reset.css             # Normalize-based reset
│   └── main.css              # Design system (~3,236 lines)
├── data/
│   └── homepage.json         # Static content data
├── types/
│   └── index.ts              # TypeScript interfaces
└── content.config.ts         # Collection schemas (glob loader)
```

### Branches
- **master** — production, deployed to Netlify
- **feature/writing** — blog/writing section (pages, components, Navbar link, content). Not yet merged. Includes `Blockquote.astro`, `CodeBlock.astro`, `Figure.astro`, writing pages, and two draft posts. Still needs: missing VHS images, placeholder post removal.

---

## Astro Configuration
**File:** `astro.config.mjs`
```javascript
export default defineConfig({
  site: 'https://joshux.com',
  integrations: [sitemap(), mdx()]
});
```

---

## Content Collections (Astro 6 Content Layer API)

Collections use the `glob()` loader (not the legacy `type: 'content'`).

### case-studies
**Schema** (from `content.config.ts`):
```typescript
loader: glob({ pattern: '**/*.mdx', base: './src/content/case-studies' })
{
  title: string;
  subtitle?: string;
  thumbnail: string;
  banner?: string;
  tags: string[];
  date?: Date;
  featured?: boolean;       // default: false
  hidden?: boolean;         // default: false
  password?: string;
  highlight?: string;
  logo?: string;
  client?: string;
  extraImage?: string;
  extraImageAlt?: string;
  extraImageHeight?: string;
  extraImageWidth?: string;
  extraImageFullWidth?: boolean;
  goal?: string;
  responsibilities?: string;
  duration?: string;
  accentColor?: string;
  heroWashColor?: string;   // RGB values
  showHeroWash?: boolean;
}
```

### writing (on feature/writing branch)
**Schema** (from `content.config.ts`):
```typescript
loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/writing' })
{
  title: string;
  date: Date;              // Required
  description: string;     // For cards/previews
  heroImage?: string;      // Optional hero image
}
```

### Astro 6 API patterns
- **Entry ID:** Use `entry.id` (not `entry.slug`). ID is derived from filename without extension.
- **Rendering:** `import { render } from 'astro:content'` then `const { Content } = await render(entry);`
- **Zod:** Import `z` from `astro/zod`, not `astro:content`.
- **Collection query:** `getCollection('case-studies')` returns entries with `.id`, `.data`, `.body`.

---

## Design Tokens

### Typography Scale (Major Third - 1.25x)
```css
--text-xs: 0.875rem;    /* 14px */
--text-sm: 1rem;        /* 16px */
--text-base: 1.25rem;   /* 20px */
--text-lg: 1.5625rem;   /* 25px */
--text-xl: 1.953rem;    /* 31px */
--text-2xl: 2.441rem;   /* 39px */
--text-3xl: 3.052rem;   /* 49px */
--text-4xl: 3.815rem;   /* 61px */
--text-5xl: 4.768rem;   /* 76px */
```

### Spacing Scale (Perfect Fourth - 2x)
```css
--space-2xs: 0.25rem;   /* 4px */
--space-xs: 0.5rem;     /* 8px */
--space-sm: 0.75rem;    /* 12px */
--space-base: 1rem;     /* 16px */
--space-lg: 1.5rem;     /* 24px */
--space-xl: 2rem;       /* 32px */
--space-2xl: 3rem;      /* 48px */
--space-3xl: 4rem;      /* 64px */
```

### Shadows
```css
--shadow-xs: 0 1px 3px rgba(0, 0, 0, 0.04);
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.06);
--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.08);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.10);
--shadow-xl: 0 12px 32px rgba(0, 0, 0, 0.12);
```

### Border Radius
```css
--radius-none: 0;
--radius-sm: 6px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 24px;
--radius-full: 9999px;
```

### Transitions
```css
--transition-fast: 0.15s ease;
--transition-normal: 0.3s ease;
--transition-slow: 0.5s ease;
```

### Colors

**Primary (Blue):**
```css
--blue-500: #2E3A59;    /* Primary */
--blue-600: #252F49;
--blue-700: #1C2339;
```

**Accent (Pink):**
```css
--pink-500: #f93b6b;    /* Accent */
--pink-400: #ff6b94;
--pink-600: #e02e5c;
```

**Neutrals (Gray):**
```css
--gray-50: #f7f8fa;     /* Surface */
--gray-100: #f0f2f5;
--gray-200: #e4e7eb;    /* Border */
--gray-500: #6b7280;
--gray-600: #49535a;    /* Text muted */
--gray-800: #272c30;    /* Text */
--gray-900: #1a1a1a;
```

**Semantic:**
```css
--color-bg: #ffffff;
--color-surface: var(--gray-50);
--color-text: var(--gray-800);
--color-text-muted: var(--gray-600);
--color-border: var(--gray-200);
--color-primary: var(--blue-500);
--color-accent: var(--pink-500);
```

### Fonts
- **Body:** "Funnel Sans", -apple-system, BlinkMacSystemFont, sans-serif
  - Weights used: 300, 400, 500, 600, 700, 800
- **Headings:** "IBM Plex Serif", Georgia, serif
  - Weights used: 400, 400i, 600, 700
- **Loaded via:** Google Fonts CDN (variable Funnel Sans, static IBM Plex Serif)

---

## Component Reference

### Cards
| Component | Use For | Key Props |
|-----------|---------|-----------|
| `Card.astro` | Featured items with rich metadata | `href, title, img, tags[], client, extraImage, isPasswordProtected` |
| `SimplifiedCard.astro` | Grid listings | `href, title, img, client?, highlight?` |

### Typography
| Component | Use For | Key Props |
|-----------|---------|-----------|
| `FeaturedQuote.astro` | Pull quotes, testimonials (with author) | `quote, authorName, authorTitle, authorImage` |
| `Testimonial.astro` | Simple quote block | `name, title?, portrait, quote` |

### Media
| Component | Use For | Key Props |
|-----------|---------|-----------|
| `ResponsiveImage.astro` | All images (AVIF/WebP) | `src, alt, mobileSrc?, maxHeight?, priority?` |
| `Video.astro` | Mux video embeds | `playbackId, title?, accentColor?` |

### Content Formatting
| Component | Use For | Key Props |
|-----------|---------|-----------|
| `StyledBulletList.astro` | Feature lists | `items[], columns?: 1|2|3` |
| `Table.astro` | Data tables | `headers[], data[][], variant?` |
| `ConversationExchange.astro` | Interviews, dialogs | `title, intro, exchanges[], outcome` |
| `BoxesAndArrows.astro` | Process flows | `steps[], className?` |

### Layout
| Component | Use For | Key Props |
|-----------|---------|-----------|
| `Navbar.astro` | Site header | `current?, useSvgLogo?` |
| `ProjectDetails.astro` | 3-col metadata | `goal, responsibilities, duration` |
| `EnhancedOutcomeGrid.astro` | Stats grid | `outcomes[], columns?, animateOnScroll?` |

---

## Key Patterns

### Related Content Section
From `work/[slug].astro`:
```astro
<section class="portfolio-block block outer">
  <div class="inner">
    <div class="block-header">
      <h2 class="block-title line-top line-top--bold">
        <strong>Other case studies</strong>
      </h2>
    </div>
    <div class="portfolio-feed">
      {items.map(item => (
        <SimplifiedCard
          href={`/work/${item.id}`}
          title={item.data.title}
          img={item.data.thumbnail}
        />
      ))}
    </div>
  </div>
</section>
```

### Dark Mode
Uses `[data-theme="dark"]` selector. Toggle in Navbar persists to localStorage.

### Responsive Breakpoints
- Mobile: <=480px
- Tablet: <=768px
- Desktop: >768px
- Wide: >1024px

---

## File Locations

| Need | Location |
|------|----------|
| Global styles | `src/styles/main.css` |
| Design tokens | `src/styles/main.css` (top ~200 lines) |
| Page layouts | `src/layouts/Layout.astro` |
| Content schema | `src/content.config.ts` |
| Homepage data | `src/data/homepage.json` |
| Type definitions | `src/types/index.ts` |

---

## Adding New Content

### New Case Study
1. Create `src/content/case-studies/[slug].mdx`
2. Add frontmatter matching schema
3. Write MDX content using available components
4. Entry ID is derived from filename (e.g., `my-study.mdx` -> `my-study`)

### New Page
1. Create `src/pages/[name].astro`
2. Import and use `Layout` from `../layouts/Layout.astro`
3. Follow existing page patterns

---

## Common CSS Classes

```css
.block            /* Section container */
.block.outer      /* Full-width section */
.inner            /* Max-width content wrapper */
.block-header     /* Section header container */
.block-title      /* Section heading */
.line-top         /* Top border accent */
.line-top--bold   /* Bold top border */
.portfolio-feed   /* Grid for cards */
.post-content     /* Prose container (styled lists, blockquotes, code, headings) */
```
