import path from 'node:path'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { evaluateCvAsRecruiter } from './src/server/evaluate-cv'

function aiCvEvaluationApiPlugin(): Plugin {
  return {
    name: 'ai-cv-evaluation-api',
    configureServer(server) {
      server.middlewares.use('/api/ai/cv-evaluation', async (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }

        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) {
            chunks.push(chunk as Buffer)
          }
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
            jobTitle?: string
            jobDescription?: string
            candidateSkills?: string[]
            candidateHeadline?: string | null
            candidateBio?: string | null
            experienceYears?: number | null
          }

          if (!body.jobTitle?.trim()) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'jobTitle is required' }))
            return
          }

          const result = evaluateCvAsRecruiter({
            jobTitle: body.jobTitle,
            jobDescription: body.jobDescription,
            candidateSkills: body.candidateSkills ?? [],
            candidateHeadline: body.candidateHeadline,
            candidateBio: body.candidateBio,
            experienceYears: body.experienceYears,
          })

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result))
        } catch {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'CV evaluation failed' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), aiCvEvaluationApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
