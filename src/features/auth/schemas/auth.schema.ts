import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

export const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.enum(['candidate', 'hr']),
    organizationName: z.string().optional(),
  })
  .refine((data) => data.role !== 'hr' || (data.organizationName?.trim().length ?? 0) >= 2, {
    message: 'Organization name is required for HR registration',
    path: ['organizationName'],
  })

export type LoginForm = z.infer<typeof loginSchema>
export type RegisterForm = z.infer<typeof registerSchema>
