import { z } from 'zod/v4';

export const FeedstockCategorySchema = z.enum(['green', 'brown']);
export type FeedstockCategory = z.infer<typeof FeedstockCategorySchema>;

export const FeedstockSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().nullable().optional(),
  status: z.string().default('active'),
});

export type FeedstockDto = z.infer<typeof FeedstockSchema>;
