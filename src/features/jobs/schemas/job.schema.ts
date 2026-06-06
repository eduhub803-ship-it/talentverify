import { z } from 'zod'

export const jobSchema = z.object({
  title: z.string().min(2, 'Title is required'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  requirements: z.string().optional(),
  experienceLevel: z.string().optional(),
  location: z.string().min(2, 'Location is required'),
  jobType: z.string().min(2, 'Job type is required'),
})

export type JobForm = z.infer<typeof jobSchema>
