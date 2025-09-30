// src/content/config.ts
import { defineCollection, z } from 'astro:content';

// Define the schema for case studies
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
    password: z.string().optional(),
  }),
});

// Export the collections
export const collections = {
  'case-studies': caseStudiesCollection,
};

