// src/content.config.ts
import { defineCollection, z } from 'astro:content';

const caseStudiesCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    subtitle: z.string(),
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
    // Project details for hero section
    goal: z.string().optional(),
    responsibilities: z.string().optional(),
    duration: z.string().optional(),
    // Custom accent color for the case study
    accentColor: z.string().optional(),
  }),
});

export const collections = {
  'case-studies': caseStudiesCollection,
};
