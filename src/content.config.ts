import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
	schema: z.object({
		title: z.string(),
		summary: z.string(),
		category: z.enum(['stats', 'ai']),
		tags: z.array(z.string()).optional(),
		links: z
			.object({
				github: z.string().url().optional(),
				demo: z.string().url().optional(),
			})
			.optional(),
		date: z.coerce.date(),
	}),
});

export const collections = { projects };
