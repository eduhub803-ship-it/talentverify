import type {
  AdminStats,
  CandidateProfile,
  CandidateRecord,
  CandidateJobApplicationContext,
  CandidateSearchFilters,
  ContactRequest,
  HrMember,
  HrOrganization,
  Job,
  JobApplication,
  Profile,
  TalentDocument,
  UsageFeature,
  UsageLimit,
  UserRole,
  VerificationQueueItem,
  VerificationStatus,
} from '@/types/domain'

const STORAGE_KEY = 'talentverify_mock_db_v2'

/** Demo PDF for CV preview */
export const DEMO_CV_URL =
  'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf'

interface MockDb {
  profiles: Profile[]
  candidates: CandidateProfile[]
  candidateRecords: CandidateRecord[]
  organizations: HrOrganization[]
  hrMembers: HrMember[]
  documents: TalentDocument[]
  contactRequests: ContactRequest[]
  jobs: Job[]
  applications: JobApplication[]
  usageLimits: UsageLimit[]
  passwordByEmail: Record<string, string>
}

function createSeedJobs(hrId: string, now: string): Job[] {
  return [
    {
      id: crypto.randomUUID(),
      title: 'Frontend Engineer',
      description:
        'Build polished verification and talent workflows for hiring teams and candidates.',
      requirements: ['React', 'TypeScript', 'Product engineering experience'],
      experienceLevel: 'Mid-level',
      location: 'Remote',
      jobType: 'Full-time',
      status: 'open',
      createdBy: hrId,
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      title: 'Talent Operations Specialist',
      description:
        'Partner with HR organizations to review candidate documentation and improve verification quality.',
      requirements: ['Recruiting operations', 'Documentation review', 'Clear communication'],
      experienceLevel: 'Entry-level',
      location: 'New York, NY',
      jobType: 'Contract',
      status: 'open',
      createdBy: hrId,
      createdAt: now,
    },
  ]
}

function seedDb(): MockDb {
  const adminId = crypto.randomUUID()
  const candidateId = crypto.randomUUID()
  const candidate2Id = crypto.randomUUID()
  const candidate3Id = crypto.randomUUID()
  const hrId = crypto.randomUUID()
  const orgId = crypto.randomUUID()
  const now = new Date().toISOString()

  return {
    profiles: [
      {
        id: adminId,
        role: 'admin',
        email: 'admin@talentverify.com',
        fullName: 'Platform Admin',
        avatarUrl: null,
        createdAt: now,
      },
      {
        id: candidateId,
        role: 'candidate',
        email: 'candidate@demo.com',
        fullName: 'Alex Morgan',
        avatarUrl: null,
        createdAt: now,
      },
      {
        id: candidate2Id,
        role: 'candidate',
        email: 'sarah.chen@demo.com',
        fullName: 'Sarah Chen',
        avatarUrl: null,
        createdAt: now,
      },
      {
        id: candidate3Id,
        role: 'candidate',
        email: 'mike.ross@demo.com',
        fullName: 'Mike Ross',
        avatarUrl: null,
        createdAt: now,
      },
      {
        id: hrId,
        role: 'hr',
        email: 'hr@demo.com',
        fullName: 'Jordan Lee',
        avatarUrl: null,
        createdAt: now,
      },
    ],
    candidates: [
      {
        userId: candidateId,
        headline: 'Senior Full Stack Engineer',
        location: 'San Francisco, CA',
        bio: 'Building scalable products with React and Node.',
        skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
        verificationStatus: 'verified',
        verifiedAt: now,
        rejectionReason: null,
        updatedAt: now,
      },
      {
        userId: candidate2Id,
        headline: 'Product Designer',
        location: 'New York, NY',
        bio: 'Enterprise UX and design systems.',
        skills: ['Figma', 'Design Systems', 'UX Research'],
        verificationStatus: 'verified',
        verifiedAt: now,
        rejectionReason: null,
        updatedAt: now,
      },
      {
        userId: candidate3Id,
        headline: 'DevOps Engineer',
        location: 'Austin, TX',
        bio: 'Cloud infrastructure and CI/CD.',
        skills: ['AWS', 'Kubernetes', 'Terraform'],
        verificationStatus: 'pending',
        verifiedAt: null,
        rejectionReason: null,
        updatedAt: now,
      },
    ],
    organizations: [
      {
        id: orgId,
        name: 'Acme Talent Partners',
        website: 'https://acme.example.com',
        industry: 'Technology',
        status: 'approved',
        approvedAt: now,
        createdAt: now,
      },
      {
        id: crypto.randomUUID(),
        name: 'Northwind Recruiting',
        website: null,
        industry: 'Finance',
        status: 'pending',
        approvedAt: null,
        createdAt: now,
      },
    ],
    hrMembers: [
      { userId: hrId, organizationId: orgId, isOwner: true },
    ],
    documents: [],
    contactRequests: [],
    jobs: createSeedJobs(hrId, now),
    applications: [],
    usageLimits: [],
    candidateRecords: [
      {
        id: candidateId,
        name: 'Alex Morgan',
        email: 'candidate@demo.com',
        cvUrl: DEMO_CV_URL,
        skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
        experienceYears: 8,
        education: 'B.S. Computer Science, Stanford University',
        aiSummary:
          'Senior engineer with full-stack expertise and a track record of shipping scalable SaaS products. Strong fit for technical leadership in product-driven teams.',
        jobMatchScore: 88,
        location: 'San Francisco, CA',
      },
      {
        id: candidate2Id,
        name: 'Sarah Chen',
        email: 'sarah.chen@demo.com',
        cvUrl: DEMO_CV_URL,
        skills: ['Figma', 'Design Systems', 'UX Research'],
        experienceYears: 6,
        education: 'M.A. Interaction Design, RISD',
        aiSummary:
          'Product designer focused on enterprise UX and design systems. Excellent collaborator with engineering and product partners.',
        jobMatchScore: 91,
        location: 'New York, NY',
      },
    ],
    passwordByEmail: {
      'admin@talentverify.com': 'admin12345',
      'candidate@demo.com': 'demo12345',
      'hr@demo.com': 'demo12345',
    },
  }
}

function loadDb(): MockDb {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const legacy = localStorage.getItem('talentverify_mock_db_v1')
    if (legacy) {
      const parsed = JSON.parse(legacy) as MockDb
      const migrated: MockDb = {
        ...parsed,
        candidateRecords: [],
        jobs: [],
        applications: [],
        usageLimits: [],
      }
      saveDb(migrated)
      localStorage.removeItem('talentverify_mock_db_v1')
      return migrated
    }
    const seeded = seedDb()
    saveDb(seeded)
    return seeded
  }
  const db = JSON.parse(raw) as MockDb
  if (!db.candidateRecords) db.candidateRecords = []
  if (!db.usageLimits) db.usageLimits = []
  if (!db.jobs) {
    const hrId = db.hrMembers[0]?.userId
    db.jobs = hrId ? createSeedJobs(hrId, new Date().toISOString()) : []
  }
  if (!db.applications) db.applications = []
  return db
}

function saveDb(db: MockDb) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

export const mockDb = {
  getSession(): { userId: string } | null {
    const id = sessionStorage.getItem('tv_session_user')
    return id ? { userId: id } : null
  },

  setSession(userId: string | null) {
    if (userId) sessionStorage.setItem('tv_session_user', userId)
    else sessionStorage.removeItem('tv_session_user')
  },

  getProfile(userId: string): Profile | undefined {
    return loadDb().profiles.find((p) => p.id === userId)
  },

  getProfileByEmail(email: string): Profile | undefined {
    return loadDb().profiles.find(
      (p) => p.email.toLowerCase() === email.toLowerCase(),
    )
  },

  login(email: string, password: string): Profile | null {
    const db = loadDb()
    const profile = db.profiles.find(
      (p) => p.email.toLowerCase() === email.toLowerCase(),
    )
    if (!profile) return null
    if (db.passwordByEmail[profile.email] !== password) return null
    this.setSession(profile.id)
    return profile
  },

  register(input: {
    email: string
    password: string
    fullName: string
    role: UserRole
    organizationName?: string
  }): Profile {
    const db = loadDb()
    if (db.profiles.some((p) => p.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error('An account with this email already exists.')
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const profile: Profile = {
      id,
      role: input.role,
      email: input.email,
      fullName: input.fullName,
      avatarUrl: null,
      createdAt: now,
    }
    db.profiles.push(profile)
    db.passwordByEmail[input.email] = input.password

    if (input.role === 'candidate') {
      db.candidates.push({
        userId: id,
        headline: null,
        location: null,
        bio: null,
        skills: [],
        verificationStatus: 'draft',
        verifiedAt: null,
        rejectionReason: null,
        updatedAt: now,
      })
      db.candidateRecords.push({
        id,
        name: input.fullName,
        email: input.email,
        cvUrl: null,
        skills: [],
        experienceYears: null,
        education: null,
        aiSummary: null,
        jobMatchScore: null,
        location: null,
      })
    }

    if (input.role === 'hr' && input.organizationName) {
      const orgId = crypto.randomUUID()
      db.organizations.push({
        id: orgId,
        name: input.organizationName,
        website: null,
        industry: null,
        status: 'pending',
        approvedAt: null,
        createdAt: now,
      })
      db.hrMembers.push({ userId: id, organizationId: orgId, isOwner: true })
    }

    saveDb(db)
    this.setSession(id)
    return profile
  },

  logout() {
    this.setSession(null)
  },

  getCandidate(userId: string): CandidateProfile | undefined {
    const db = loadDb()
    const candidate = db.candidates.find((c) => c.userId === userId)
    if (!candidate) return undefined
    const profile = db.profiles.find((p) => p.id === userId)
    return {
      ...candidate,
      profile: profile
        ? {
            fullName: profile.fullName,
            email: profile.email,
            avatarUrl: profile.avatarUrl,
          }
        : undefined,
    }
  },

  updateCandidate(
    userId: string,
    patch: Partial<
      Pick<CandidateProfile, 'headline' | 'location' | 'bio' | 'skills'>
    >,
  ): CandidateProfile {
    const db = loadDb()
    const idx = db.candidates.findIndex((c) => c.userId === userId)
    if (idx === -1) throw new Error('Candidate profile not found')
    db.candidates[idx] = {
      ...db.candidates[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    saveDb(db)
    this.syncCandidateRecord(userId)
    return this.getCandidate(userId)!
  },

  submitForVerification(userId: string) {
    const db = loadDb()
    const idx = db.candidates.findIndex((c) => c.userId === userId)
    if (idx === -1) throw new Error('Candidate not found')
    db.candidates[idx].verificationStatus = 'pending'
    db.candidates[idx].updatedAt = new Date().toISOString()
    saveDb(db)
  },

  getDocuments(candidateId: string): TalentDocument[] {
    return loadDb().documents.filter((d) => d.candidateId === candidateId)
  },

  addDocument(
    candidateId: string,
    doc: Omit<TalentDocument, 'id' | 'candidateId' | 'uploadedAt'>,
  ): TalentDocument {
    const db = loadDb()
    const record: TalentDocument = {
      id: crypto.randomUUID(),
      candidateId,
      uploadedAt: new Date().toISOString(),
      ...doc,
    }
    db.documents.push(record)
    saveDb(db)
    if (doc.type === 'cv') {
      this.syncCandidateRecord(candidateId)
    }
    return record
  },

  deleteDocument(candidateId: string, documentId: string) {
    const db = loadDb()
    db.documents = db.documents.filter(
      (d) => !(d.id === documentId && d.candidateId === candidateId),
    )
    saveDb(db)
  },

  searchVerifiedCandidates(filters: CandidateSearchFilters): CandidateProfile[] {
    const db = loadDb()
    let results = db.candidates.filter((c) => c.verificationStatus === 'verified')

    if (filters.query) {
      const q = filters.query.toLowerCase()
      results = results.filter((c) => {
        const profile = db.profiles.find((p) => p.id === c.userId)
        return (
          c.headline?.toLowerCase().includes(q) ||
          c.location?.toLowerCase().includes(q) ||
          profile?.fullName?.toLowerCase().includes(q) ||
          c.skills.some((s) => s.toLowerCase().includes(q))
        )
      })
    }

    if (filters.location) {
      const loc = filters.location.toLowerCase()
      results = results.filter((c) => c.location?.toLowerCase().includes(loc))
    }

    if (filters.skills?.length) {
      results = results.filter((c) =>
        filters.skills!.every((skill) =>
          c.skills.some((s) => s.toLowerCase() === skill.toLowerCase()),
        ),
      )
    }

    return results.map((c) => {
      const profile = db.profiles.find((p) => p.id === c.userId)
      return {
        ...c,
        profile: profile
          ? {
              fullName: profile.fullName,
              email: profile.email,
              avatarUrl: profile.avatarUrl,
            }
          : undefined,
      }
    })
  },

  getHrMember(userId: string): HrMember | undefined {
    const db = loadDb()
    const member = db.hrMembers.find((m) => m.userId === userId)
    if (!member) return undefined
    const organization = db.organizations.find((o) => o.id === member.organizationId)
    return { ...member, organization }
  },

  getContactRequestsForCandidate(candidateId: string): ContactRequest[] {
    const db = loadDb()
    return db.contactRequests
      .filter((r) => r.candidateId === candidateId)
      .map((r) => {
        const hr = db.profiles.find((p) => p.id === r.hrUserId)
        const org = db.organizations.find((o) => o.id === r.organizationId)
        return {
          ...r,
          hrName: hr?.fullName ?? undefined,
          organizationName: org?.name,
        }
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
  },

  sendContactRequest(input: {
    hrUserId: string
    candidateId: string
    organizationId: string
    message: string
  }): ContactRequest {
    const db = loadDb()
    const exists = db.contactRequests.some(
      (r) =>
        r.hrUserId === input.hrUserId &&
        r.candidateId === input.candidateId &&
        r.organizationId === input.organizationId,
    )
    if (exists) throw new Error('You have already contacted this candidate.')

    const record: ContactRequest = {
      id: crypto.randomUUID(),
      ...input,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    db.contactRequests.push(record)
    saveDb(db)
    return record
  },

  respondContactRequest(
    requestId: string,
    candidateId: string,
    status: 'accepted' | 'declined',
  ) {
    const db = loadDb()
    const idx = db.contactRequests.findIndex(
      (r) => r.id === requestId && r.candidateId === candidateId,
    )
    if (idx === -1) throw new Error('Request not found')
    db.contactRequests[idx].status = status
    saveDb(db)
  },

  listJobs(createdBy?: string): Job[] {
    const db = loadDb()
    return db.jobs
      .filter((job) => !createdBy || job.createdBy === createdBy)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
  },

  listOpenJobs(): Job[] {
    return this.listJobs().filter((job) => job.status === 'open')
  },

  getJob(id: string): Job | undefined {
    return loadDb().jobs.find((job) => job.id === id)
  },

  createJob(input: {
    title: string
    description: string
    requirements: string[]
    experienceLevel?: string | null
    location: string
    jobType: string
    createdBy: string
  }): Job {
    const db = loadDb()
    const job: Job = {
      id: crypto.randomUUID(),
      title: input.title,
      description: input.description,
      requirements: input.requirements,
      experienceLevel: input.experienceLevel ?? null,
      location: input.location,
      jobType: input.jobType,
      status: 'open',
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
    }
    db.jobs.push(job)
    saveDb(db)
    return job
  },

  getApplicationsForJob(jobId: string): JobApplication[] {
    const db = loadDb()
    return db.applications
      .filter((application) => application.jobId === jobId)
      .map((application) => ({
        ...application,
        candidate: this.getCandidateRecord(application.candidateId) ?? null,
      }))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
  },

  updateApplicationStatus(
    applicationId: string,
    status: JobApplication['status'],
  ): JobApplication {
    const db = loadDb()
    const idx = db.applications.findIndex((application) => application.id === applicationId)
    if (idx === -1) throw new Error('Application not found')
    db.applications[idx].status = status
    saveDb(db)
    return {
      ...db.applications[idx],
      candidate: this.getCandidateRecord(db.applications[idx].candidateId) ?? null,
    }
  },

  getCandidateJobApplicationContext(
    candidateId: string,
  ): CandidateJobApplicationContext {
    const db = loadDb()
    const existingCv = db.documents.find(
      (doc) => doc.candidateId === candidateId && doc.type === 'cv',
    )
    const record = db.candidateRecords.find((candidate) => candidate.id === candidateId)
    return {
      existingCvUrl: existingCv ? this.getDocumentPublicUrl(existingCv) : record?.cvUrl ?? null,
      existingCvName: existingCv?.fileName ?? (record?.cvUrl ? 'Verified CV' : null),
      appliedJobIds: db.applications
        .filter((application) => application.candidateId === candidateId)
        .map((application) => application.jobId),
    }
  },

  applyToJob(input: {
    jobId: string
    candidateId: string
    message?: string | null
    cvFile?: File | null
    useExistingCv?: boolean
  }): JobApplication {
    const db = loadDb()
    const job = db.jobs.find((item) => item.id === input.jobId)
    if (!job || job.status !== 'open') throw new Error('This job is not open.')

    const duplicate = db.applications.some(
      (application) =>
        application.jobId === input.jobId &&
        application.candidateId === input.candidateId,
    )
    if (duplicate) throw new Error('You have already applied to this job.')

    const existingCv = db.documents.find(
      (doc) => doc.candidateId === input.candidateId && doc.type === 'cv',
    )
    const candidateRecord = db.candidateRecords.find(
      (candidate) => candidate.id === input.candidateId,
    )
    let cvUrl: string | null = null

    if (input.cvFile) {
      db.documents.push({
        id: crypto.randomUUID(),
        candidateId: input.candidateId,
        type: 'cv',
        fileName: input.cvFile.name,
        storagePath: `mock/${input.candidateId}/${input.cvFile.name}`,
        mimeType: input.cvFile.type,
        fileSize: input.cvFile.size,
        uploadedAt: new Date().toISOString(),
        publicUrl: DEMO_CV_URL,
      })
      cvUrl = DEMO_CV_URL
    } else if (input.useExistingCv) {
      cvUrl = existingCv ? this.getDocumentPublicUrl(existingCv) : candidateRecord?.cvUrl ?? null
    }

    if (!cvUrl) throw new Error('Add a CV before applying to this job.')

    const application: JobApplication = {
      id: crypto.randomUUID(),
      jobId: input.jobId,
      candidateId: input.candidateId,
      cvUrl,
      message: input.message?.trim() || null,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    db.applications.push(application)
    saveDb(db)
    return {
      ...application,
      candidate: this.getCandidateRecord(input.candidateId) ?? null,
    }
  },

  getVerificationQueue(): VerificationQueueItem[] {
    const db = loadDb()
    return db.candidates
      .filter((c) =>
        ['pending', 'under_review'].includes(c.verificationStatus),
      )
      .map((c) => {
        const profile = db.profiles.find((p) => p.id === c.userId)!
        return {
          userId: c.userId,
          fullName: profile.fullName ?? 'Unknown',
          email: profile.email,
          headline: c.headline,
          verificationStatus: c.verificationStatus,
          documentCount: db.documents.filter((d) => d.candidateId === c.userId)
            .length,
          updatedAt: c.updatedAt,
        }
      })
  },

  reviewCandidate(
    userId: string,
    status: VerificationStatus,
    notes?: string,
  ) {
    const db = loadDb()
    const idx = db.candidates.findIndex((c) => c.userId === userId)
    if (idx === -1) throw new Error('Candidate not found')
    db.candidates[idx].verificationStatus = status
    db.candidates[idx].rejectionReason =
      status === 'rejected' ? notes ?? 'Did not meet verification requirements.' : null
    db.candidates[idx].verifiedAt =
      status === 'verified' ? new Date().toISOString() : null
    db.candidates[idx].updatedAt = new Date().toISOString()
    saveDb(db)
    if (status === 'verified') {
      this.syncCandidateRecord(userId)
    }
  },

  getCandidateRecord(id: string): CandidateRecord | undefined {
    const db = loadDb()
    let record = db.candidateRecords.find((r) => r.id === id)
    if (!record) {
      this.syncCandidateRecord(id)
      record = loadDb().candidateRecords.find((r) => r.id === id)
    }
    return record
  },

  syncCandidateRecord(userId: string) {
    const db = loadDb()
    const profile = db.profiles.find((p) => p.id === userId)
    const candidate = db.candidates.find((c) => c.userId === userId)
    if (!profile || !candidate) return

    const cvDoc = db.documents.find(
      (d) => d.candidateId === userId && d.type === 'cv',
    )
    const cvUrl = cvDoc ? DEMO_CV_URL : null

    const payload: CandidateRecord = {
      id: userId,
      name: profile.fullName ?? profile.email,
      email: profile.email,
      cvUrl,
      skills: candidate.skills,
      experienceYears: inferExperienceYears(candidate.bio),
      education: inferEducation(candidate.bio),
      aiSummary: candidate.bio
        ? `Verified professional: ${candidate.headline ?? 'Specialist'}. ${candidate.bio}`
        : null,
      jobMatchScore: candidate.verificationStatus === 'verified' ? 85 : null,
      location: candidate.location,
    }

    const idx = db.candidateRecords.findIndex((r) => r.id === userId)
    if (idx === -1) db.candidateRecords.push(payload)
    else db.candidateRecords[idx] = { ...db.candidateRecords[idx], ...payload }
    saveDb(db)
  },

  getUsageLimit(userId: string, feature: UsageFeature): UsageLimit {
    const db = loadDb()
    const found = db.usageLimits.find(
      (u) => u.userId === userId && u.feature === feature,
    )
    if (found) return found
    return {
      userId,
      feature,
      count: 0,
      updatedAt: new Date().toISOString(),
    }
  },

  incrementUsage(userId: string, feature: UsageFeature): UsageLimit {
    const db = loadDb()
    const idx = db.usageLimits.findIndex(
      (u) => u.userId === userId && u.feature === feature,
    )
    const now = new Date().toISOString()
    if (idx === -1) {
      const record: UsageLimit = { userId, feature, count: 1, updatedAt: now }
      db.usageLimits.push(record)
      saveDb(db)
      return record
    }
    db.usageLimits[idx].count += 1
    db.usageLimits[idx].updatedAt = now
    saveDb(db)
    return db.usageLimits[idx]
  },

  getDocumentPublicUrl(doc: TalentDocument): string | null {
    if (doc.type !== 'cv') return null
    return DEMO_CV_URL
  },

  getPendingHrOrgs(): HrOrganization[] {
    return loadDb().organizations.filter((o) => o.status === 'pending')
  },

  reviewHrOrg(orgId: string, approved: boolean) {
    const db = loadDb()
    const idx = db.organizations.findIndex((o) => o.id === orgId)
    if (idx === -1) throw new Error('Organization not found')
    db.organizations[idx].status = approved ? 'approved' : 'rejected'
    db.organizations[idx].approvedAt = approved
      ? new Date().toISOString()
      : null
    saveDb(db)
  },

  getAdminStats(): AdminStats {
    const db = loadDb()
    return {
      pendingVerifications: db.candidates.filter((c) =>
        ['pending', 'under_review'].includes(c.verificationStatus),
      ).length,
      pendingHrOrgs: db.organizations.filter((o) => o.status === 'pending').length,
      verifiedCandidates: db.candidates.filter(
        (c) => c.verificationStatus === 'verified',
      ).length,
      totalCandidates: db.candidates.length,
    }
  },
}

function inferExperienceYears(bio: string | null): number | null {
  if (!bio) return null
  const match = bio.match(/(\d+)\+?\s*years?/i)
  return match ? Number(match[1]) : null
}

function inferEducation(bio: string | null): string | null {
  if (!bio) return null
  if (/b\.?s\.|m\.?s\.|ph\.?d|university|college/i.test(bio)) return bio.slice(0, 120)
  return null
}
