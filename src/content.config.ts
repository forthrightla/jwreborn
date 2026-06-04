import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const caseStudiesCollection = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/case-studies' }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    seoDescription: z.string().optional(),
    thumbnail: z.string(),
    banner: z.string().optional(),
    tags: z.array(z.string()),
    date: z.date().optional(),
    featured: z.boolean().default(false),
    hidden: z.boolean().default(false),
    password: z.string().optional(),
    highlight: z.string().optional(),
    logo: z.string().optional(),
    client: z.string().optional(),
    extraImage: z.string().optional(),
    extraImageAlt: z.string().optional(),
    extraImageHeight: z.string().optional(),
    extraImageWidth: z.string().optional(),
    extraImageFullWidth: z.boolean().optional(),
    goal: z.string().optional(),
    responsibilities: z.string().optional(),
    duration: z.string().optional(),
    accentColor: z.string().optional(),
    heroWashColor: z.string().optional(),
    showHeroWash: z.boolean().optional()
  }),
});

const writingCollection = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    description: z.string(),
    heroImage: z.string().optional(),
  }),
});

export const collections = {
  'case-studies': caseStudiesCollection,
  'writing': writingCollection,
};
