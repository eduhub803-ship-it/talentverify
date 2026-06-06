# TalentVerify

A professional verified talent platform where candidates upload CVs and credentials for verification. Verified candidates become searchable by approved HR organizations.

**Not a social network** — no posts, feeds, comments, connections, or public candidate browsing.

## Tech stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Supabase (Auth, Postgres, Storage)
- React Router, React Query, Zustand, Zod

## Getting started

```bash
cd talentverify
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Demo mode (no Supabase)

Without `.env`, the app runs in **local demo mode** using browser storage.

| Role      | Email                     | Password    |
|-----------|---------------------------|-------------|
| Candidate | candidate@demo.com        | demo12345   |
| HR        | hr@demo.com               | demo12345   |
| Admin     | admin@talentverify.com    | admin12345  |

### Production (Supabase)

1. Create a Supabase project.
2. Copy `.env.example` to `.env` and add your URL and anon key.
3. Run `supabase/migrations/001_initial_schema.sql` in the SQL editor.
4. Create a storage bucket `candidate-documents` (private).
5. Add an Edge Function or trigger to create `profiles` rows on signup from `raw_user_meta_data`.

## Project structure

```
src/features/
  auth/          Login, register, landing, route guards
  candidate/     Dashboard, profile, uploads, contacts
  hr/            Dashboard, search, candidate detail
  admin/         Dashboard, verification queue, HR approvals
  profile/       Shared profile schemas
  verification/  Verification timeline UI
  jobs/          Placeholder for future module
  shared/        UI components, layouts, hooks
```

## MVP screens

1. Landing Page  
2. Login / Register  
3. Candidate Dashboard, Profile, Upload CV, Documents, Verification Status, **AI CV Evaluation**  
4. HR Dashboard, Candidate Search, **Full Candidate Profile** (`/hr/candidate/:id`)  
5. Admin Dashboard, Verification Queue, HR Approvals  

## Architecture

- **UI** — React pages/components (no business logic, no Supabase calls)
- **Actions** — `src/features/*/actions.ts` orchestrate workflows
- **Services** — `src/features/*/api/*.service.ts` and `src/services/` for data access
- **API** — `POST /api/ai/cv-evaluation` (Vite dev middleware; deploy as Edge Function in production)

## Freemium

Each user gets **2 free** AI CV evaluations (`usage_limits` table, feature `cv_evaluation`).

## Scripts

- `npm run dev` — development server  
- `npm run build` — production build  
- `npm run preview` — preview production build  
