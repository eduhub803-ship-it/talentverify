import { z } from 'zod'

export const candidateProfileSchema = z.object({
  headline: z.string().max(120).optional().or(z.literal('')),
  location: z.string().max(80).optional().or(z.literal('')),
  bio: z.string().max(2000).optional().or(z.literal('')),
  skillsInput: z.string().optional(),
})

export type CandidateProfileForm = z.infer<typeof candidateProfileSchema>
