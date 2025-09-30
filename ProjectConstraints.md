# Project Constraints & Architecture Guide

## Project Overview
This is Josh Wright's professional UX portfolio website, showcasing case studies from work at companies like Indeed, AXS, LegalZoom, Cerebral, and others. The site emphasizes thoughtful design, user research, and measurable outcomes. Built with Astro and "lovingly vibe-coded with Claude Opus 4 over the course of 2025."

## Core Technology Stack
- **Framework**: Astro 
- **Content Format**: MDX for rich case studies
- **Styling**: Custom CSS with reset.css and main.css (no CSS frameworks)
- **CMS**: Decap CMS (formerly Netlify CMS) for content management
- **Deployment**: Netlify (with _redirects for legacy URLs)
- **Analytics**: Microsoft Clarity
- **Video**: Mux Player for embedded videos
- **Site URL**: https://joshux.com

## Architecture Principles

### 1. Static Site Generation
- All pages are statically generated at build time
- Case studies are generated from MDX files in `src/content/case-studies/`
- Dynamic paths handled via Astro's getStaticPaths()

### 2. Component-Based Design
- Reusable Astro components in `src/components/`
- MDX allows embedding components directly in case study content
- Components follow single-responsibility principle

### 3. Content-Driven Structure
```
src/content/
└── case-studies/     # MDX files for each case study
    ├── axs-event-entry-case-study.mdx
    ├── cerebral-case-study.mdx
    ├── indeed-ai-case-study.mdx (password protected)
    ├── jumprope-nationals-case-study.mdx
    ├── makerspace-case-study.mdx
    ├── oreilly-case-study.mdx
    └── ribbon-legalzoom-case-study.mdx
```

## Design System

### Colors
```css
Primary Blues: #00296b, #00509d (gradients)
Accent Pink: #f93b6b
Text Primary: #272c30
Text Secondary: #49535a
Background: #fff, #fafafa, #f9f9f9
```

### Typography
- **Headings**: IBM Plex Serif (serif)
- **Body**: Funnel Sans (sans-serif)  
- **Responsive sizing**: Base 120% font-size on html

### Shadow System
```css
--shadow-sm: 0 2px 10px rgba(0, 0, 0, 0.06)
--shadow-md: 0 8px 25px rgba(0, 0, 0, 0.1)
--shadow-lg: 0 4px 20px rgba(0, 0, 0, 0.12)
```

### Spacing & Layout
- Outer padding: 4vw
- Max content width: 1140px
- Inner-small max width: 960px
- Consistent use of rem units (1rem = ~19.2px at 120% base)

## Component Library

### Layout Components
- **EnhancedOutcomeGrid**: Displays outcome cards in responsive grid
- **BoxesAndArrows**: Process flow visualization
- **ResponsiveImage**: Handles responsive images with optional mobile variants

### Content Components
- **FeaturedQuote**: Testimonial with avatar and attribution
- **ProjectDetails**: Structured project metadata (goal, responsibilities, duration)
- **ConversationExchange**: Dialogue-style content presentation
- **ParticipantInsights**: Research participant profiles with insights
- **Table**: Modern styled tables with variants (default, compact, striped)

### UI Components
- **Card**: Project card with thumbnail and optional lock icon
- **Navbar**: Sticky navigation with mobile menu
- **Video**: Mux player integration wrapper
- **Testimonial**: Quote block with author details
- **Skill**: Icon-based skill/methodology display

## Content Schema

### Case Study Frontmatter
```yaml
title: string (required)
subtitle: string (required)
thumbnail: string (required) # Card image
banner: string (optional) # Hero image
tags: array (required) # e.g., ["UX Design", "Research"]
featured: boolean (default: false)
password: string (optional) # Enables fake password protection
outcomes: array (optional) # Not currently used in templates
```

### Case Study Categories (via tags)
- Mobile App
- Product Launch / Product Strategy
- Research / Field Research  
- Enterprise UX / Enterprise Software
- AI Integration
- UX Design

## Page Structure

### Home Page (`src/pages/index.astro`)
1. Hero section with tagline
2. Methodology section (3 principles)
3. Featured testimonial
4. Selected case studies (4 featured)
5. About section with logos

### Case Studies Page (`src/pages/case-studies.astro`)
- Grouped by categories based on tags
- Shows all case studies with password lock indicators

### Individual Case Study (`src/pages/work/[slug].astro`)
- Dynamic routing based on slug
- Password protection UI (intentionally non-functional)
- MDX content rendering
- "Other case studies" recommendations

## Password Protection Pattern
The site includes a clever UX pattern for password-protected case studies:
- Shows password form but NEVER actually validates
- Always shows error after ~800ms delay
- Serves as a boundary/filter for confidential work
- Contact prompt encourages reaching out directly

## URL Structure & Redirects
Legacy URLs are redirected via `public/_redirects`:
- `/projects/*` → `/work/*`
- Maintains SEO and prevents broken links

## Build & Development

### Key Scripts (inferred)
```bash
npm run dev      # Local development
npm run build    # Production build
npm run preview  # Preview production build
```

### CMS Configuration
- GitHub backend connected to forthrightla/jwreborn repo
- Admin panel at /admin
- Local development option available

## Component Usage Patterns

### In MDX Files
```mdx
import Video from '../../components/Video.astro';
import EnhancedOutcomeGrid from '../../components/layouts/EnhancedOutcomeGrid.astro';

<Video playbackId="..." title="..." />

<EnhancedOutcomeGrid 
  outcomes={[{stat: "+68%", description: "...", colorClass: "primary"}]}
  columns={2}
/>
```

### Responsive Images
```astro
<ResponsiveImage 
  src="/images/desktop.png"
  mobileSrc="/images/mobile.png"  
  alt="Description"
  maxHeight="600px"
  contain={true}
/>
```

## Style Patterns

### Mobile-First Responsive Design
- Breakpoints: 480px, 768px, 800px, 1024px
- Navigation transforms to slide-out menu on mobile
- Grid layouts collapse to single column

### Animation Strategy
- Subtle fadeInDown on page load
- Hover effects on cards and buttons
- Reduced motion respected via media query

### Component Styling
- Scoped styles within Astro components
- Global styles in src/styles/
- No CSS-in-JS or CSS modules

## Content Guidelines

### Case Study Structure
1. Summary with ProjectDetails
2. Key outcomes (EnhancedOutcomeGrid)
3. Optional FeaturedQuote
4. Background/Challenge/Role sections
5. Discovery/Research/Process
6. Solution/Implementation
7. Results/Reflection
8. Repeated outcomes at end

### Writing Style
- First-person narrative ("I led", "I designed")
- Emphasis on measurable outcomes
- Balance of strategic thinking and tactical execution
- Clear problem → solution → impact flow

## Performance Considerations
- Static generation for all pages
- Lazy loading for images
- Mux player loaded only when needed
- Minimal JavaScript (primarily for mobile nav)

## Future Development Guidelines

### When Adding New Components
1. Create in src/components/
2. Use Astro's scoped styling
3. Support responsive design
4. Include TypeScript interfaces for props
5. Document usage in component comments

### When Adding Case Studies
1. Create MDX file in src/content/case-studies/
2. Follow existing frontmatter schema
3. Use established components for consistency
4. Optimize images before adding
5. Update Decap CMS if schema changes

### Design Token Updates
- Maintain existing color variables
- Keep shadow system consistent
- Preserve typography hierarchy
- Test on all breakpoints

## Testing Checklist
- [ ] Mobile navigation functionality
- [ ] All case study routes resolve
- [ ] Images load correctly (including responsive variants)
- [ ] Password protection UI displays properly
- [ ] Redirects work as expected
- [ ] CMS can create/edit content
- [ ] Accessibility (semantic HTML, alt text)

## Known Patterns & Decisions

### Intentional Design Choices
- Password protection is deliberately non-functional (UX boundary)
- Heavy use of gradients in brand colors
- Prominent use of outcomes/metrics
- Case studies as primary content type

### Technical Decisions
- MDX over markdown for rich content
- Astro over Next.js/Gatsby for simplicity
- Custom CSS over Tailwind for full control
- Static generation over SSR for performance

## Dependencies to Maintain
- Astro (core framework)
- @astrojs/sitemap (SEO)
- @astrojs/mdx (content format)
- No other critical runtime dependencies

---

This document serves as the source of truth for development decisions and patterns in Josh Wright's portfolio site. When in doubt, follow existing patterns for consistency.