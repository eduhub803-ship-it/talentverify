-- TalentVerify initial schema
-- Run via Supabase CLI: supabase db push

CREATE TYPE user_role AS ENUM ('candidate', 'hr', 'admin');
CREATE TYPE verification_status AS ENUM ('draft', 'pending', 'under_review', 'verified', 'rejected');
CREATE TYPE hr_org_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE document_type AS ENUM ('cv', 'certificate', 'experience');
CREATE TYPE contact_request_status AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE candidate_profiles (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  headline TEXT,
  location TEXT,
  bio TEXT,
  skills TEXT[] DEFAULT '{}',
  verification_status verification_status DEFAULT 'draft',
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE hr_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  website TEXT,
  industry TEXT,
  status hr_org_status DEFAULT 'pending',
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE hr_members (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES hr_organizations(id) ON DELETE CASCADE,
  is_owner BOOLEAN DEFAULT false
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  type document_type NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size INT,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE verification_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(user_id),
  reviewer_id UUID NOT NULL REFERENCES profiles(id),
  status verification_status NOT NULL,
  notes TEXT,
  reviewed_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hr_user_id UUID NOT NULL REFERENCES profiles(id),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(user_id),
  organization_id UUID NOT NULL REFERENCES hr_organizations(id),
  message TEXT NOT NULL,
  status contact_request_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (hr_user_id, candidate_id, organization_id)
);

CREATE INDEX idx_candidate_verified ON candidate_profiles(verification_status)
  WHERE verification_status = 'verified';
CREATE INDEX idx_candidate_skills ON candidate_profiles USING GIN(skills);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY profiles_select ON profiles FOR SELECT USING (
  auth.uid() = id
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  OR EXISTS (
    SELECT 1 FROM candidate_profiles cp
    WHERE cp.user_id = profiles.id
      AND cp.verification_status = 'verified'
      AND EXISTS (
        SELECT 1 FROM hr_members hm
        JOIN hr_organizations ho ON ho.id = hm.organization_id
        WHERE hm.user_id = auth.uid() AND ho.status = 'approved'
      )
  )
);

CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING (auth.uid() = id);

-- Candidate profiles
CREATE POLICY candidate_own ON candidate_profiles FOR ALL USING (auth.uid() = user_id);

CREATE POLICY candidate_hr_read ON candidate_profiles FOR SELECT USING (
  verification_status = 'verified'
  AND EXISTS (
    SELECT 1 FROM hr_members hm
    JOIN hr_organizations ho ON ho.id = hm.organization_id
    WHERE hm.user_id = auth.uid() AND ho.status = 'approved'
  )
);

CREATE POLICY candidate_admin ON candidate_profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Documents
CREATE POLICY documents_candidate ON documents FOR ALL USING (auth.uid() = candidate_id);
CREATE POLICY documents_admin ON documents FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Contact requests
CREATE POLICY contact_hr_insert ON contact_requests FOR INSERT WITH CHECK (auth.uid() = hr_user_id);
CREATE POLICY contact_read ON contact_requests FOR SELECT USING (
  auth.uid() = hr_user_id OR auth.uid() = candidate_id
);
CREATE POLICY contact_candidate_update ON contact_requests FOR UPDATE USING (auth.uid() = candidate_id);
