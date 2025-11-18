import { defineCollection, z } from 'astro:content';
import type { CaseStudyData } from './types';

const caseStudiesCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    subtitle: z.string(),
    thumbnail: z.string(),
    banner: z.string().optional(),
    tags: z.array(z.string()),
    featured: z.boolean().default(false),
    password: z.string().optional(),
    outcomes: z.array(z.any()).optional(),
  }) satisfies z.ZodType<CaseStudyData>,
});

export const collections = {
  'case-studies': caseStudiesCollection,
};
