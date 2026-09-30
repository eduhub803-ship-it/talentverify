import type {
  AdminStats,
  EmployerPlan,
  EmployerServiceRequest,
  JobAlert,
  PartnershipStatus,
  TalentRequestShortlistItem,
  CareerServiceRequest,
  CareerServiceRequestStatus,
  CareerServiceResult,
  CandidateDirectoryEntry,
  CandidateImportBatch,
  ImportedCandidate,
  ImportedCandidateData,
  AppNotification,
  CandidateProfile,
  CandidateRecord,
  CandidateJobApplicationContext,
  CandidateSearchFilters,
  CandidateShortlist,
  CandidateCareerPreferences,
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
import { getActiveCvDocument } from '@/features/candidate/cv-workflow'
import { normalizeEmail } from '@/features/admin/import/normalize'
import { requireCareerService } from '@/features/career-services/catalog'
import { requireEmployerService } from '@/features/employer/catalog'
import { alertsMatchingJob } from '@/features/employer/alerts'
import { visibleJobsForCandidate } from '@/features/employer/matching'
import { limitsFor } from '@/features/employer/plans'
import {
  assertTransition,
  candidateCanCancel,
  findBlockingRequest,
  initialPaymentStatusFor,
  initialStatusFor,
  prerequisiteState,
} from '@/features/career-services/rules'

const STORAGE_KEY = 'talentverify_mock_db_v2'

/** Demo PDF for CV preview */
export const DEMO_CV_URL =
  'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf'

const defaultCareerPreferences: CandidateCareerPreferences = {
  openToWork: true,
  employmentTypes: [],
  preferredFields: [],
  preferredLocations: [],
  remotePreference: 'flexible',
  availabilityTiming: 'immediate',
}

function makeSehTalentId(index: number): string {
  return `SEH-2026-${String(index).padStart(6, '0')}`
}

function normalizeCandidate(candidate: CandidateProfile, index = 0): CandidateProfile {
  return {
    ...candidate,
    sehTalentId: candidate.sehTalentId ?? makeSehTalentId(index + 1),
    structuredSkills: candidate.structuredSkills ?? candidate.skills.map((name) => ({
      id: crypto.randomUUID(),
      name,
      category: 'Technical',
      level: 'Advanced',
    })),
    education: candidate.education ?? [],
    experience: candidate.experience ?? [],
    languages: candidate.languages ?? [],
    projects: candidate.projects ?? [],
    sehTraining: candidate.sehTraining ?? [],
    credentials: candidate.credentials ?? [],
    careerPreferences: {
      ...defaultCareerPreferences,
      ...(candidate.careerPreferences ?? {}),
    },
    linkedinUrl: candidate.linkedinUrl ?? null,
    employerVisible: candidate.employerVisible ?? candidate.verificationStatus === 'verified',
  }
}

interface MockDb {
  profiles: Profile[]
  candidates: CandidateProfile[]
  candidateRecords: CandidateRecord[]
  organizations: HrOrganization[]
  hrMembers: HrMember[]
  documents: TalentDocument[]
  contactRequests: ContactRequest[]
  shortlists: CandidateShortlist[]
  jobs: Job[]
  applications: JobApplication[]
  usageLimits: UsageLimit[]
  notifications: AppNotification[]
  importedCandidates: ImportedCandidate[]
  candidateImports: CandidateImportBatch[]
  careerServiceRequests: CareerServiceRequest[]
  jobAlerts: JobAlert[]
  employerServiceRequests: EmployerServiceRequest[]
  talentRequestShortlists: TalentRequestShortlistItem[]
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
        sehTalentId: makeSehTalentId(1),
        headline: 'Senior Full Stack Engineer',
        location: 'San Francisco, CA',
        bio: 'Building scalable products with React and Node.',
        skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
        structuredSkills: [
          { id: crypto.randomUUID(), name: 'React', category: 'Technical', level: 'Expert' },
          { id: crypto.randomUUID(), name: 'TypeScript', category: 'Technical', level: 'Advanced' },
        ],
        education: [
          { id: crypto.randomUUID(), institution: 'Stanford University', program: 'B.S. Computer Science', startYear: '2012', endYear: '2016' },
        ],
        experience: [
          { id: crypto.randomUUID(), company: 'Demo SaaS', title: 'Senior Engineer', startDate: '2019', endDate: null, description: 'Led product engineering work.' },
        ],
        languages: [{ id: crypto.randomUUID(), name: 'English', level: 'Expert' }],
        projects: [],
        sehTraining: [
          { id: crypto.randomUUID(), program: 'SEH Full Stack Track', provider: 'SEH', completionDate: '2026-05-15', verifiedBySeh: true },
        ],
        credentials: [],
        careerPreferences: {
          openToWork: true,
          employmentTypes: ['Full-time'],
          preferredFields: ['Software Engineering'],
          preferredLocations: ['Remote', 'San Francisco, CA'],
          remotePreference: 'remote',
          availabilityTiming: 'two_weeks',
        },
        linkedinUrl: 'https://linkedin.com/in/alex-morgan-demo',
        employerVisible: true,
        verificationStatus: 'verified',
        verifiedAt: now,
        rejectionReason: null,
        updatedAt: now,
      },
      {
        userId: candidate2Id,
        sehTalentId: makeSehTalentId(2),
        headline: 'Product Designer',
        location: 'New York, NY',
        bio: 'Enterprise UX and design systems.',
        skills: ['Figma', 'Design Systems', 'UX Research'],
        structuredSkills: [
          { id: crypto.randomUUID(), name: 'Figma', category: 'Digital', level: 'Expert' },
          { id: crypto.randomUUID(), name: 'UX Research', category: 'Communication', level: 'Advanced' },
        ],
        education: [],
        experience: [],
        languages: [],
        projects: [],
        sehTraining: [],
        credentials: [],
        careerPreferences: {
          openToWork: true,
          employmentTypes: ['Contract', 'Full-time'],
          preferredFields: ['Product Design'],
          preferredLocations: ['New York, NY', 'Remote'],
          remotePreference: 'hybrid',
          availabilityTiming: 'one_month',
        },
        linkedinUrl: null,
        employerVisible: true,
        verificationStatus: 'verified',
        verifiedAt: now,
        rejectionReason: null,
        updatedAt: now,
      },
      {
        userId: candidate3Id,
        sehTalentId: makeSehTalentId(3),
        headline: 'DevOps Engineer',
        location: 'Austin, TX',
        bio: 'Cloud infrastructure and CI/CD.',
        skills: ['AWS', 'Kubernetes', 'Terraform'],
        structuredSkills: [
          { id: crypto.randomUUID(), name: 'AWS', category: 'Technical', level: 'Advanced' },
        ],
        education: [],
        experience: [],
        languages: [],
        projects: [],
        sehTraining: [],
        credentials: [],
        careerPreferences: defaultCareerPreferences,
        linkedinUrl: null,
        employerVisible: false,
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
    shortlists: [],
    jobs: createSeedJobs(hrId, now),
    applications: [],
    usageLimits: [],
    notifications: [],
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
    importedCandidates: [],
    candidateImports: [],
    careerServiceRequests: [],
    jobAlerts: [],
    employerServiceRequests: [],
    talentRequestShortlists: [],
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
        shortlists: [],
        importedCandidates: [],
        candidateImports: [],
        careerServiceRequests: [],
        jobAlerts: [],
        employerServiceRequests: [],
        talentRequestShortlists: [],
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
  if (!db.notifications) db.notifications = []
  if (!db.shortlists) db.shortlists = []
  if (!db.importedCandidates) db.importedCandidates = []
  if (!db.candidateImports) db.candidateImports = []
  if (!db.careerServiceRequests) db.careerServiceRequests = []
  if (!db.jobAlerts) db.jobAlerts = []
  if (!db.employerServiceRequests) db.employerServiceRequests = []
  if (!db.talentRequestShortlists) db.talentRequestShortlists = []
  db.organizations = db.organizations.map((organization) => ({
    plan: 'free' as const,
    ...organization,
  }))
  db.candidates = db.candidates.map((candidate, index) =>
    normalizeCandidate(candidate, index),
  )
  return db
}

function saveDb(db: MockDb) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

/* --------------------------- career services helpers --------------------------- */

function decorateCareerRequest(
  db: MockDb,
  request: CareerServiceRequest,
): CareerServiceRequest {
  const profile = db.profiles.find((item) => item.id === request.candidateId)
  const assignee = request.assignedTo
    ? db.profiles.find((item) => item.id === request.assignedTo)
    : undefined
  return {
    ...request,
    candidateName: profile?.fullName ?? profile?.email ?? 'Candidate',
    candidateEmail: profile?.email ?? '',
    assignedToName: assignee?.fullName ?? assignee?.email ?? null,
  }
}

function notifyCareerStaff(
  db: MockDb,
  request: CareerServiceRequest,
  title: string,
  message: string,
) {
  const now = new Date().toISOString()
  db.notifications.push(
    ...db.profiles
      .filter((profile) => profile.role === 'admin')
      .map((admin) => ({
        id: crypto.randomUUID(),
        recipientUserId: admin.id,
        recipientRole: 'admin' as const,
        type: 'career_service_request',
        title,
        message,
        entityType: 'career_service_request',
        entityId: request.id,
        isRead: false,
        priority: 'normal' as const,
        createdAt: now,
      })),
  )
}

function notifyCareerCandidate(
  db: MockDb,
  request: CareerServiceRequest,
  type: string,
  title: string,
  message: string,
  priority: 'low' | 'normal' | 'high',
) {
  db.notifications.push({
    id: crypto.randomUUID(),
    recipientUserId: request.candidateId,
    recipientRole: 'candidate',
    type,
    title,
    message,
    entityType: 'career_service_request',
    entityId: request.id,
    isRead: false,
    priority,
    createdAt: new Date().toISOString(),
  })
}

/** Candidate-facing notification for a staff transition, if one is warranted. */
function careerCandidateNotification(
  status: CareerServiceRequestStatus,
  serviceName: string,
  adminMessage: string | null,
  resultSummary: string | null,
): { type: string; title: string; message: string } | null {
  switch (status) {
    case 'ready':
      return {
        type: 'career_service_ready',
        title: 'Payment confirmed',
        message: `Your ${serviceName} request is confirmed and queued with the career team.`,
      }
    case 'in_progress':
      return {
        type: 'career_service_in_progress',
        title: 'Work started',
        message: `The career team started working on your ${serviceName} request.`,
      }
    case 'waiting_candidate':
      return {
        type: 'career_service_information_required',
        title: 'More information needed',
        message: adminMessage?.trim() || 'The career team needs more information.',
      }
    case 'scheduled':
      return {
        type: 'career_service_scheduled',
        title: 'Session scheduled',
        message: `Your ${serviceName} session is scheduled.`,
      }
    case 'completed':
      return {
        type: 'career_service_completed',
        title: `${serviceName} completed`,
        message: resultSummary || 'Your service is complete.',
      }
    case 'cancelled':
      return {
        type: 'career_service_cancelled',
        title: 'Request cancelled',
        message: `Your ${serviceName} request was cancelled.`,
      }
    default:
      return null
  }
}

/* ------------------------- employer services helpers ------------------------ */

/** Attaches the owning organization so candidate lists can show a verified badge. */
function decorateJob(db: MockDb, job: Job): Job {
  const member = db.hrMembers.find((item) => item.userId === job.createdBy)
  const organizationId = job.organizationId ?? member?.organizationId ?? null
  const organization = organizationId
    ? db.organizations.find((item) => item.id === organizationId)
    : undefined
  return {
    ...job,
    organizationId,
    organizationName: organization?.name ?? null,
    employerVerified: organization?.status === 'approved',
    isExclusive: Boolean(job.isExclusive),
    tracks: job.tracks ?? [],
  }
}

function decorateEmployerRequest(
  db: MockDb,
  request: EmployerServiceRequest,
): EmployerServiceRequest {
  const organization = db.organizations.find((item) => item.id === request.organizationId)
  const requester = db.profiles.find((item) => item.id === request.requestedBy)
  const assignee = request.assignedTo
    ? db.profiles.find((item) => item.id === request.assignedTo)
    : undefined
  return {
    ...request,
    organizationName: organization?.name ?? 'Organization',
    requestedByName: requester?.fullName ?? requester?.email ?? 'HR user',
    assignedToName: assignee?.fullName ?? assignee?.email ?? null,
  }
}

function notifyOrganization(
  db: MockDb,
  organizationId: string,
  notification: {
    type: string
    title: string
    message: string
    entityType: string
    entityId: string
    priority?: 'low' | 'normal' | 'high'
  },
) {
  const now = new Date().toISOString()
  db.notifications.push(
    ...db.hrMembers
      .filter((member) => member.organizationId === organizationId)
      .map((member) => ({
        id: crypto.randomUUID(),
        recipientUserId: member.userId,
        recipientRole: 'hr' as const,
        recipientOrganizationId: organizationId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        entityType: notification.entityType,
        entityId: notification.entityId,
        isRead: false,
        priority: notification.priority ?? 'normal',
        createdAt: now,
      })),
  )
}

function notifyAdmins(
  db: MockDb,
  notification: {
    type: string
    title: string
    message: string
    entityType: string
    entityId: string
    organizationId?: string | null
    priority?: 'low' | 'normal' | 'high'
  },
) {
  const now = new Date().toISOString()
  db.notifications.push(
    ...db.profiles
      .filter((profile) => profile.role === 'admin')
      .map((admin) => ({
        id: crypto.randomUUID(),
        recipientUserId: admin.id,
        recipientRole: 'admin' as const,
        recipientOrganizationId: notification.organizationId ?? null,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        entityType: notification.entityType,
        entityId: notification.entityId,
        isRead: false,
        priority: notification.priority ?? 'normal',
        createdAt: now,
      })),
  )
}

/**
 * Service 30: raises a notification for every saved alert a newly published job
 * matches. Exclusive roles only reach candidates eligible to see them.
 */
function fireJobAlerts(db: MockDb, job: Job) {
  const decorated = decorateJob(db, job)
  const eligible = (candidateId: string) =>
    db.candidates.find((candidate) => candidate.userId === candidateId)
      ?.verificationStatus === 'verified'

  const matches = alertsMatchingJob(
    db.jobAlerts.filter((alert) => alert.active),
    decorated,
    eligible,
  )

  const now = new Date().toISOString()
  for (const { alert, reasons } of matches) {
    const index = db.jobAlerts.findIndex((item) => item.id === alert.id)
    if (index !== -1) {
      db.jobAlerts[index] = {
        ...db.jobAlerts[index],
        lastMatchedAt: now,
        matchCount: db.jobAlerts[index].matchCount + 1,
        updatedAt: now,
      }
    }
    db.notifications.push({
      id: crypto.randomUUID(),
      recipientUserId: alert.candidateId,
      recipientRole: 'candidate',
      type: 'job_alert_match',
      title: `New match: ${job.title}`,
      message: `${job.title} matches your "${alert.name}" alert. ${reasons.join(' · ')}`,
      entityType: 'job',
      entityId: job.id,
      isRead: false,
      priority: 'normal',
      createdAt: now,
    })
  }
}


/** Resolves display fields from the live candidate record; never copies it. */
function decorateShortlistItem(
  db: MockDb,
  item: TalentRequestShortlistItem,
): TalentRequestShortlistItem {
  const profile = db.profiles.find((entry) => entry.id === item.candidateId)
  const candidate = db.candidates.find((entry) => entry.userId === item.candidateId)
  return {
    ...item,
    candidateName: profile?.fullName ?? profile?.email ?? 'Candidate',
    headline: candidate?.headline ?? null,
    location: candidate?.location ?? null,
    sehTalentId: candidate?.sehTalentId ?? null,
    skills: candidate?.skills ?? [],
  }
}

export const mockDb = {
  addNotification(input: Omit<AppNotification, 'id' | 'isRead' | 'createdAt'>) {
    const db = loadDb()
    const notification: AppNotification = {
      id: crypto.randomUUID(),
      isRead: false,
      createdAt: new Date().toISOString(),
      ...input,
    }
    db.notifications.push(notification)
    saveDb(db)
    return notification
  },

  notifyAdmins(input: Omit<AppNotification, 'id' | 'isRead' | 'createdAt' | 'recipientUserId' | 'recipientRole'>) {
    const db = loadDb()
    const admins = db.profiles.filter((profile) => profile.role === 'admin')
    const now = new Date().toISOString()
    const notifications = admins.map((admin) => ({
      id: crypto.randomUUID(),
      recipientUserId: admin.id,
      recipientRole: 'admin' as const,
      isRead: false,
      createdAt: now,
      ...input,
    }))
    db.notifications.push(...notifications)
    saveDb(db)
    return notifications
  },

  notifyOrganizationUsers(
    organizationId: string,
    input: Omit<AppNotification, 'id' | 'isRead' | 'createdAt' | 'recipientUserId' | 'recipientRole' | 'recipientOrganizationId'>,
  ) {
    const db = loadDb()
    const members = db.hrMembers.filter((member) => member.organizationId === organizationId)
    const now = new Date().toISOString()
    const notifications = members.map((member) => ({
      id: crypto.randomUUID(),
      recipientUserId: member.userId,
      recipientRole: 'hr' as const,
      recipientOrganizationId: organizationId,
      isRead: false,
      createdAt: now,
      ...input,
    }))
    db.notifications.push(...notifications)
    saveDb(db)
    return notifications
  },

  getNotificationsForUser(currentUser: Profile): AppNotification[] {
    const db = loadDb()
    const membership = currentUser.role === 'hr'
      ? db.hrMembers.find((member) => member.userId === currentUser.id)
      : null

    return db.notifications
      .filter((notification) => {
        if (currentUser.role === 'admin') {
          return (
            notification.recipientUserId === currentUser.id ||
            notification.recipientRole === 'admin'
          )
        }
        if (currentUser.role === 'hr') {
          return (
            notification.recipientUserId === currentUser.id ||
            Boolean(
              membership?.organizationId &&
                notification.recipientRole === 'hr' &&
                notification.recipientOrganizationId === membership.organizationId,
            )
          )
        }
        return notification.recipientUserId === currentUser.id
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
  },

  markNotificationRead(currentUser: Profile, notificationId: string) {
    const visible = this.getNotificationsForUser(currentUser).some(
      (notification) => notification.id === notificationId,
    )
    if (!visible) return
    const db = loadDb()
    const idx = db.notifications.findIndex((notification) => notification.id === notificationId)
    if (idx === -1) return
    db.notifications[idx].isRead = true
    saveDb(db)
  },

  markAllNotificationsRead(currentUser: Profile) {
    const visibleIds = new Set(
      this.getNotificationsForUser(currentUser).map((notification) => notification.id),
    )
    const db = loadDb()
    db.notifications = db.notifications.map((notification) =>
      visibleIds.has(notification.id)
        ? { ...notification, isRead: true }
        : notification,
    )
    saveDb(db)
  },

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
      // Mirror of the Supabase claim trigger: a previously imported roster row
      // pre-fills the new profile. Verification and visibility stay untouched.
      const rosterKey = normalizeEmail(input.email)
      const roster = db.importedCandidates.find(
        (row) => row.normalizedEmail === rosterKey && row.status === 'imported',
      )

      db.candidates.push({
        userId: id,
        sehTalentId: makeSehTalentId(db.candidates.length + 1),
        headline: roster?.headline ?? null,
        location: roster?.location ?? null,
        bio: roster?.bio ?? null,
        skills: roster?.skills ?? [],
        structuredSkills: roster?.structuredSkills ?? [],
        education: roster?.education ?? [],
        experience: roster?.experience ?? [],
        languages: roster?.languages ?? [],
        projects: [],
        sehTraining: roster?.sehTraining ?? [],
        credentials: [],
        careerPreferences: roster?.careerPreferences ?? defaultCareerPreferences,
        linkedinUrl: roster?.linkedinUrl ?? null,
        employerVisible: false,
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
        skills: roster?.skills ?? [],
        experienceYears: null,
        education: null,
        aiSummary: null,
        jobMatchScore: null,
        location: roster?.location ?? null,
        employerVisible: false,
      })

      if (roster) {
        roster.status = 'claimed'
        roster.claimedUserId = id
        roster.claimedAt = now
        roster.updatedAt = now
      }
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
      db.notifications.push({
        id: crypto.randomUUID(),
        recipientUserId: id,
        recipientRole: 'hr',
        recipientOrganizationId: orgId,
        type: 'hr_organization_pending',
        title: 'Organization pending approval',
        message: 'Your organization account is pending approval.',
        entityType: 'organization',
        entityId: orgId,
        isRead: false,
        priority: 'normal',
        createdAt: now,
      })
      const admins = db.profiles.filter((profile) => profile.role === 'admin')
      db.notifications.push(
        ...admins.map((admin) => ({
          id: crypto.randomUUID(),
          recipientUserId: admin.id,
          recipientRole: 'admin' as const,
          recipientOrganizationId: orgId,
          type: 'hr_organization_registered',
          title: 'New HR organization pending approval',
          message: `${input.organizationName} is pending approval.`,
          entityType: 'organization',
          entityId: orgId,
          isRead: false,
          priority: 'high' as const,
          createdAt: now,
        })),
      )
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
      Pick<
        CandidateProfile,
        | 'headline'
        | 'location'
        | 'bio'
        | 'skills'
        | 'structuredSkills'
        | 'education'
        | 'experience'
        | 'languages'
        | 'projects'
        | 'sehTraining'
        | 'credentials'
        | 'careerPreferences'
        | 'linkedinUrl'
        | 'employerVisible'
      >
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
    const candidateProfile = db.profiles.find((profile) => profile.id === userId)
    const now = new Date().toISOString()
    db.notifications.push({
      id: crypto.randomUUID(),
      recipientUserId: userId,
      recipientRole: 'candidate',
      type: 'candidate_verification_submitted',
      title: 'Verification request submitted',
      message: 'Your verification request was submitted.',
      entityType: 'candidate',
      entityId: userId,
      isRead: false,
      priority: 'normal',
      createdAt: now,
    })
    db.notifications.push(
      ...db.profiles
        .filter((profile) => profile.role === 'admin')
        .map((admin) => ({
          id: crypto.randomUUID(),
          recipientUserId: admin.id,
          recipientRole: 'admin' as const,
          type: 'candidate_verification_pending',
          title: 'Candidate submitted verification',
          message: `${candidateProfile?.fullName ?? candidateProfile?.email ?? 'Candidate'} submitted a verification request.`,
          entityType: 'candidate',
          entityId: userId,
          isRead: false,
          priority: 'high' as const,
          createdAt: now,
        })),
    )
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
    db.notifications.push({
      id: crypto.randomUUID(),
      recipientUserId: candidateId,
      recipientRole: 'candidate',
      type: 'document_uploaded',
      title: 'Document uploaded',
      message: `${record.fileName} was uploaded.`,
      entityType: 'document',
      entityId: record.id,
      isRead: false,
      priority: doc.type === 'cv' ? 'normal' : 'low',
      createdAt: new Date().toISOString(),
    })
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
    db.notifications.push({
      id: crypto.randomUUID(),
      recipientUserId: candidateId,
      recipientRole: 'candidate',
      type: 'document_removed',
      title: 'Document removed',
      message: 'A document was removed from your profile.',
      entityType: 'document',
      entityId: documentId,
      isRead: false,
      priority: 'low',
      createdAt: new Date().toISOString(),
    })
    saveDb(db)
  },

  searchVerifiedCandidates(filters: CandidateSearchFilters): CandidateProfile[] {
    const db = loadDb()
    let results = db.candidates.filter(
      (c) => c.verificationStatus === 'verified' && c.employerVisible,
    )

    if (filters.query) {
      const q = filters.query.toLowerCase()
      results = results.filter((c) => {
        const profile = db.profiles.find((p) => p.id === c.userId)
        return (
          c.headline?.toLowerCase().includes(q) ||
          c.location?.toLowerCase().includes(q) ||
          profile?.fullName?.toLowerCase().includes(q) ||
          c.skills.some((s) => s.toLowerCase().includes(q)) ||
          c.structuredSkills.some((s) => s.name.toLowerCase().includes(q)) ||
          c.careerPreferences.preferredFields.some((field) =>
            field.toLowerCase().includes(q),
          )
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
          c.skills.some((s) => s.toLowerCase() === skill.toLowerCase()) ||
          c.structuredSkills.some((s) => s.name.toLowerCase() === skill.toLowerCase()),
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
    const hr = db.profiles.find((profile) => profile.id === input.hrUserId)
    const org = db.organizations.find((item) => item.id === input.organizationId)
    const candidate = db.profiles.find((profile) => profile.id === input.candidateId)
    const now = new Date().toISOString()
    db.notifications.push({
      id: crypto.randomUUID(),
      recipientUserId: input.candidateId,
      recipientRole: 'candidate',
      recipientOrganizationId: input.organizationId,
      type: 'contact_request_received',
      title: 'New contact request',
      message: `${org?.name ?? 'An HR organization'} requested to contact you.`,
      entityType: 'contact_request',
      entityId: record.id,
      isRead: false,
      priority: 'high',
      createdAt: now,
    })
    db.notifications.push(
      ...db.hrMembers
        .filter((member) => member.organizationId === input.organizationId)
        .map((member) => ({
          id: crypto.randomUUID(),
          recipientUserId: member.userId,
          recipientRole: 'hr' as const,
          recipientOrganizationId: input.organizationId,
          type: 'contact_request_sent',
          title: 'Contact request sent',
          message: `${hr?.fullName ?? hr?.email ?? 'Your team'} requested contact with ${candidate?.fullName ?? candidate?.email ?? 'a candidate'}.`,
          entityType: 'contact_request',
          entityId: record.id,
          isRead: false,
          priority: 'normal' as const,
          createdAt: now,
        })),
    )
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
    const request = db.contactRequests[idx]
    const candidate = db.profiles.find((profile) => profile.id === candidateId)
    const now = new Date().toISOString()
    db.notifications.push(
      ...db.hrMembers
        .filter((member) => member.organizationId === request.organizationId)
        .map((member) => ({
          id: crypto.randomUUID(),
          recipientUserId: member.userId,
          recipientRole: 'hr' as const,
          recipientOrganizationId: request.organizationId,
          type: 'contact_request_updated',
          title: 'Contact request updated',
          message: `${candidate?.fullName ?? candidate?.email ?? 'A candidate'} ${status} your contact request.`,
          entityType: 'contact_request',
          entityId: request.id,
          isRead: false,
          priority: 'normal' as const,
          createdAt: now,
        })),
    )
    saveDb(db)
  },

  listShortlistedCandidateIds(hrUserId: string, organizationId: string): string[] {
    return loadDb().shortlists
      .filter((item) => item.hrUserId === hrUserId && item.organizationId === organizationId)
      .map((item) => item.candidateId)
  },

  toggleShortlist(input: {
    hrUserId: string
    candidateId: string
    organizationId: string
  }): { shortlisted: boolean } {
    const db = loadDb()
    const existingIndex = db.shortlists.findIndex(
      (item) =>
        item.hrUserId === input.hrUserId &&
        item.candidateId === input.candidateId &&
        item.organizationId === input.organizationId,
    )

    if (existingIndex >= 0) {
      db.shortlists.splice(existingIndex, 1)
      saveDb(db)
      return { shortlisted: false }
    }

    db.shortlists.push({
      id: crypto.randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    })
    saveDb(db)
    return { shortlisted: true }
  },

  listJobs(createdBy?: string): Job[] {
    const db = loadDb()
    return db.jobs
      .filter((job) => !createdBy || job.createdBy === createdBy)
      .map((job) => decorateJob(db, job))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
  },

  listOpenJobs(): Job[] {
    return this.listJobs().filter((job) => job.status === 'open')
  },

  getJob(id: string): Job | undefined {
    const db = loadDb()
    const job = db.jobs.find((item) => item.id === id)
    return job ? decorateJob(db, job) : undefined
  },

  createJob(input: {
    title: string
    description: string
    requirements: string[]
    experienceLevel?: string | null
    location: string
    jobType: string
    status?: Job['status']
    createdBy: string
    isExclusive?: boolean
    tracks?: Job['tracks']
  }): Job {
    const db = loadDb()
    const owner = db.hrMembers.find((item) => item.userId === input.createdBy)

    // Service 33: the Free plan caps how many posts an employer may keep live.
    if (owner) {
      const organization = db.organizations.find(
        (item) => item.id === owner.organizationId,
      )
      const limit = limitsFor(organization).activeJobPosts
      if (limit !== null) {
        const memberIds = new Set(
          db.hrMembers
            .filter((member) => member.organizationId === owner.organizationId)
            .map((member) => member.userId),
        )
        const active = db.jobs.filter(
          (job) => memberIds.has(job.createdBy) && ['open', 'draft'].includes(job.status),
        ).length
        if (active >= limit) {
          throw new Error(
            `Your Free plan allows ${limit} active job posts. Close a job or upgrade to Pro to post more.`,
          )
        }
      }
    }

    const job: Job = {
      id: crypto.randomUUID(),
      title: input.title,
      description: input.description,
      requirements: input.requirements,
      experienceLevel: input.experienceLevel ?? null,
      location: input.location,
      jobType: input.jobType,
      status: input.status ?? 'open',
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
      organizationId: owner?.organizationId ?? null,
      isExclusive: Boolean(input.isExclusive),
      tracks: input.tracks ?? [],
    }
    db.jobs.push(job)
    const member = owner
    if (member) {
      const now = new Date().toISOString()
      const org = db.organizations.find((item) => item.id === member.organizationId)
      db.notifications.push(
        ...db.hrMembers
          .filter((item) => item.organizationId === member.organizationId)
          .map((item) => ({
            id: crypto.randomUUID(),
            recipientUserId: item.userId,
            recipientRole: 'hr' as const,
            recipientOrganizationId: member.organizationId,
            type: 'job_created',
            title: 'Job posted',
            message: `${job.title} was posted for ${org?.name ?? 'your organization'}.`,
            entityType: 'job',
            entityId: job.id,
            isRead: false,
            priority: 'normal' as const,
            createdAt: now,
          })),
      )
      db.notifications.push(
        ...db.profiles
          .filter((profile) => profile.role === 'admin')
          .map((admin) => ({
            id: crypto.randomUUID(),
            recipientUserId: admin.id,
            recipientRole: 'admin' as const,
            recipientOrganizationId: member.organizationId,
            type: 'job_created_admin',
            title: 'HR posted a job',
            message: `${org?.name ?? 'An HR organization'} posted ${job.title}.`,
            entityType: 'job',
            entityId: job.id,
            isRead: false,
            priority: 'low' as const,
            createdAt: now,
          })),
      )
    }
    if (job.status === 'open') fireJobAlerts(db, job)
    saveDb(db)
    return decorateJob(db, job)
  },

  updateJobStatus(id: string, status: Job['status']): Job {
    const db = loadDb()
    const idx = db.jobs.findIndex((job) => job.id === id)
    if (idx === -1) throw new Error('Job not found')
    const previous = db.jobs[idx].status
    db.jobs[idx] = { ...db.jobs[idx], status }
    // Publishing a draft is the moment saved alerts should fire.
    if (status === 'open' && previous !== 'open') fireJobAlerts(db, db.jobs[idx])
    saveDb(db)
    return decorateJob(db, db.jobs[idx])
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
    const application = db.applications[idx]
    const job = db.jobs.find((item) => item.id === application.jobId)
    const candidate = db.profiles.find((profile) => profile.id === application.candidateId)
    const member = job ? db.hrMembers.find((item) => item.userId === job.createdBy) : null
    const now = new Date().toISOString()
    db.notifications.push({
      id: crypto.randomUUID(),
      recipientUserId: application.candidateId,
      recipientRole: 'candidate',
      recipientOrganizationId: member?.organizationId ?? null,
      type: 'application_status_updated',
      title: 'Application status updated',
      message: `Your application for ${job?.title ?? 'a job'} is now ${status}.`,
      entityType: 'application',
      entityId: application.id,
      isRead: false,
      priority: status === 'accepted' ? 'high' : 'normal',
      createdAt: now,
    })
    if (member) {
      db.notifications.push(
        ...db.hrMembers
          .filter((item) => item.organizationId === member.organizationId)
          .map((item) => ({
            id: crypto.randomUUID(),
            recipientUserId: item.userId,
            recipientRole: 'hr' as const,
            recipientOrganizationId: member.organizationId,
            type: 'application_status_updated_hr',
            title: 'Application status updated',
            message: `${candidate?.fullName ?? candidate?.email ?? 'A candidate'} was marked ${status} for ${job?.title ?? 'a job'}.`,
            entityType: 'application',
            entityId: application.id,
            isRead: false,
            priority: 'normal' as const,
            createdAt: now,
          })),
      )
    }
    db.notifications.push(
      ...db.profiles
        .filter((profile) => profile.role === 'admin')
        .map((admin) => ({
          id: crypto.randomUUID(),
          recipientUserId: admin.id,
          recipientRole: 'admin' as const,
          recipientOrganizationId: member?.organizationId ?? null,
          type: 'application_status_updated_admin',
          title: 'Hiring funnel updated',
          message: `${candidate?.fullName ?? 'A candidate'} was marked ${status}.`,
          entityType: 'application',
          entityId: application.id,
          isRead: false,
          priority: 'low' as const,
          createdAt: now,
        })),
    )
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
    const existingCv = getActiveCvDocument(
      db.documents.filter((doc) => doc.candidateId === candidateId),
    )
    const record = db.candidateRecords.find((candidate) => candidate.id === candidateId)
    const mine = db.applications.filter(
      (application) => application.candidateId === candidateId,
    )
    return {
      existingCvUrl: existingCv ? this.getDocumentPublicUrl(existingCv) : record?.cvUrl ?? null,
      existingCvName: existingCv?.fileName ?? (record?.cvUrl ? 'Verified CV' : null),
      appliedJobIds: mine.map((application) => application.jobId),
      applications: mine.map((application) => ({
        jobId: application.jobId,
        status: application.status,
        createdAt: application.createdAt,
      })),
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

    const existingCv = getActiveCvDocument(
      db.documents.filter((doc) => doc.candidateId === input.candidateId),
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
    const candidate = db.profiles.find((profile) => profile.id === input.candidateId)
    const member = db.hrMembers.find((item) => item.userId === job.createdBy)
    const now = new Date().toISOString()
    db.notifications.push({
      id: crypto.randomUUID(),
      recipientUserId: input.candidateId,
      recipientRole: 'candidate',
      recipientOrganizationId: member?.organizationId ?? null,
      type: 'application_submitted',
      title: 'Application submitted',
      message: `Your application for ${job.title} was submitted.`,
      entityType: 'application',
      entityId: application.id,
      isRead: false,
      priority: 'normal',
      createdAt: now,
    })
    if (member) {
      db.notifications.push(
        ...db.hrMembers
          .filter((item) => item.organizationId === member.organizationId)
          .map((item) => ({
            id: crypto.randomUUID(),
            recipientUserId: item.userId,
            recipientRole: 'hr' as const,
            recipientOrganizationId: member.organizationId,
            type: 'application_received',
            title: 'New job application',
            message: `${candidate?.fullName ?? candidate?.email ?? 'A candidate'} applied to ${job.title}.`,
            entityType: 'application',
            entityId: application.id,
            isRead: false,
            priority: 'high' as const,
            createdAt: now,
          })),
      )
    }
    db.notifications.push(
      ...db.profiles
        .filter((profile) => profile.role === 'admin')
        .map((admin) => ({
          id: crypto.randomUUID(),
          recipientUserId: admin.id,
          recipientRole: 'admin' as const,
          recipientOrganizationId: member?.organizationId ?? null,
          type: 'application_submitted_admin',
          title: 'Candidate applied to a job',
          message: `${candidate?.fullName ?? 'A candidate'} applied to ${job.title}.`,
          entityType: 'application',
          entityId: application.id,
          isRead: false,
          priority: 'low' as const,
          createdAt: now,
        })),
    )
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
          avatarUrl: profile.avatarUrl,
          headline: c.headline,
          location: c.location,
          bio: c.bio,
          linkedinUrl: c.linkedinUrl,
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
    const candidateProfile = db.profiles.find((profile) => profile.id === userId)
    const now = new Date().toISOString()
    db.notifications.push({
      id: crypto.randomUUID(),
      recipientUserId: userId,
      recipientRole: 'candidate',
      type: status === 'verified' ? 'candidate_verified' : 'candidate_rejected',
      title: status === 'verified' ? 'Profile verified' : 'Verification update',
      message:
        status === 'verified'
          ? 'Your profile has been verified.'
          : 'Your verification request was reviewed. Please check your profile status.',
      entityType: 'candidate',
      entityId: userId,
      isRead: false,
      priority: 'high',
      createdAt: now,
    })
    db.notifications.push(
      ...db.profiles
        .filter((profile) => profile.role === 'admin')
        .map((admin) => ({
          id: crypto.randomUUID(),
          recipientUserId: admin.id,
          recipientRole: 'admin' as const,
          type: status === 'verified' ? 'candidate_verified_admin' : 'candidate_rejected_admin',
          title: status === 'verified' ? 'Candidate verified' : 'Candidate rejected',
          message: `${candidateProfile?.fullName ?? candidateProfile?.email ?? 'Candidate'} was ${status}.`,
          entityType: 'candidate',
          entityId: userId,
          isRead: false,
          priority: 'normal' as const,
          createdAt: now,
        })),
    )
    saveDb(db)
    this.syncCandidateRecord(userId)
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

    const cvDoc = getActiveCvDocument(
      db.documents.filter((document) => document.candidateId === userId),
    )
    const cvUrl = cvDoc ? DEMO_CV_URL : null

    const payload: CandidateRecord = {
      id: userId,
      sehTalentId: candidate.sehTalentId,
      name: profile.fullName ?? profile.email,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
      cvUrl,
      skills: candidate.skills,
      structuredSkills: candidate.structuredSkills,
      experienceYears: inferExperienceYears(candidate.bio),
      education:
        candidate.education[0]
          ? `${candidate.education[0].program}, ${candidate.education[0].institution}`
          : inferEducation(candidate.bio),
      aiSummary: candidate.bio
        ? `Verified professional: ${candidate.headline ?? 'Specialist'}. ${candidate.bio}`
        : null,
      jobMatchScore: candidate.verificationStatus === 'verified' ? 85 : null,
      location: candidate.location,
      employerVisible: candidate.employerVisible,
      openToWork: candidate.careerPreferences.openToWork,
      employmentTypes: candidate.careerPreferences.employmentTypes,
      preferredFields: candidate.careerPreferences.preferredFields,
      preferredLocations: candidate.careerPreferences.preferredLocations,
      remotePreference: candidate.careerPreferences.remotePreference,
      availabilityTiming: candidate.careerPreferences.availabilityTiming,
    }

    const idx = db.candidateRecords.findIndex((r) => r.id === userId)
    if (idx === -1) db.candidateRecords.push(payload)
    else db.candidateRecords[idx] = { ...db.candidateRecords[idx], ...payload }
    saveDb(db)
  },

  /* ----------------------- bulk candidate import ----------------------- */

  /** Every email already known to the platform, for duplicate detection. */
  getCandidateDirectory(): CandidateDirectoryEntry[] {
    const db = loadDb()

    // Registered accounts are reported without data: an existing platform
    // account is always skipped, never diffed or merged.
    const registered: CandidateDirectoryEntry[] = db.profiles.map((profile) => ({
      normalizedEmail: normalizeEmail(profile.email),
      source: 'registered',
      id: profile.id,
      fullName: profile.fullName,
      role: profile.role,
      status: null,
      data: null,
    }))

    const imported: CandidateDirectoryEntry[] = db.importedCandidates.map((row) => ({
      normalizedEmail: row.normalizedEmail,
      source: 'imported',
      id: row.id,
      fullName: row.fullName,
      role: 'candidate',
      status: row.status,
      data: row,
    }))

    const seen = new Set<string>()
    return [...registered, ...imported].filter((entry) => {
      if (!entry.normalizedEmail || seen.has(entry.normalizedEmail)) return false
      seen.add(entry.normalizedEmail)
      return true
    })
  },

  listImportedCandidates(batchId?: string): ImportedCandidate[] {
    const rows = loadDb().importedCandidates
    const filtered = batchId ? rows.filter((row) => row.batchId === batchId) : rows
    return [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  listCandidateImportBatches(): CandidateImportBatch[] {
    return [...loadDb().candidateImports].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    )
  },

  /**
   * Persists only the rows the caller already validated. Re-checks the roster
   * and the registered profiles inside the same write so a re-run of the same
   * file can never create a second record for one email.
   */
  importCandidates(input: {
    fileName: string
    importedBy: string
    rows: { rowNumber: number; data: ImportedCandidateData }[]
    skippedDuplicateCount: number
    conflictCount: number
    errorCount: number
    totalRows: number
  }): { batch: CandidateImportBatch; created: ImportedCandidate[]; skipped: string[] } {
    const db = loadDb()
    const now = new Date().toISOString()
    const batchId = crypto.randomUUID()

    const taken = new Set<string>([
      ...db.profiles.map((profile) => normalizeEmail(profile.email)),
      ...db.importedCandidates.map((row) => row.normalizedEmail),
    ])

    const created: ImportedCandidate[] = []
    const skipped: string[] = []

    for (const row of input.rows) {
      const key = row.data.normalizedEmail
      if (!key || taken.has(key)) {
        skipped.push(row.data.email)
        continue
      }
      taken.add(key)
      const record: ImportedCandidate = {
        ...row.data,
        id: crypto.randomUUID(),
        batchId,
        status: 'imported',
        claimedUserId: null,
        claimedAt: null,
        sourceRowNumber: row.rowNumber,
        createdAt: now,
        updatedAt: now,
      }
      db.importedCandidates.push(record)
      created.push(record)
    }

    const batch: CandidateImportBatch = {
      id: batchId,
      fileName: input.fileName,
      importedBy: input.importedBy,
      createdAt: now,
      totalRows: input.totalRows,
      createdCount: created.length,
      skippedDuplicateCount: input.skippedDuplicateCount + skipped.length,
      conflictCount: input.conflictCount,
      errorCount: input.errorCount,
    }
    db.candidateImports.push(batch)

    db.notifications.push(
      ...db.profiles
        .filter((profile) => profile.role === 'admin')
        .map((admin) => ({
          id: crypto.randomUUID(),
          recipientUserId: admin.id,
          recipientRole: 'admin' as const,
          type: 'candidate_bulk_import',
          title: 'Candidate import completed',
          message: `${created.length} candidate(s) imported from ${input.fileName}.`,
          entityType: 'candidate_import',
          entityId: batchId,
          isRead: false,
          priority: 'normal' as const,
          createdAt: now,
        })),
    )

    saveDb(db)
    return { batch, created, skipped }
  },

  /* ------------------------- career services -------------------------- */

  listCareerServiceRequests(): CareerServiceRequest[] {
    const db = loadDb()
    return db.careerServiceRequests
      .map((request) => decorateCareerRequest(db, request))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  },

  /** Candidate-facing read: internal staff notes are stripped, never sent. */
  listCareerServiceRequestsForCandidate(candidateId: string): CareerServiceRequest[] {
    const db = loadDb()
    return db.careerServiceRequests
      .filter((request) => request.candidateId === candidateId)
      .map((request) => ({ ...decorateCareerRequest(db, request), internalNotes: null }))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  },

  getCareerServiceRequest(id: string): CareerServiceRequest | undefined {
    const db = loadDb()
    const request = db.careerServiceRequests.find((item) => item.id === id)
    return request ? decorateCareerRequest(db, request) : undefined
  },

  createCareerServiceRequest(input: {
    candidateId: string
    serviceCode: string
    candidateInput: Record<string, string>
    candidateNotes?: string | null
    /** Self-service assessments arrive already resolved. */
    result?: CareerServiceResult | null
  }): CareerServiceRequest {
    const service = requireCareerService(input.serviceCode)
    if (!service.active) throw new Error('This service is not currently available.')

    const db = loadDb()
    const mine = db.careerServiceRequests.filter(
      (request) => request.candidateId === input.candidateId,
    )

    const prerequisite = prerequisiteState(service, mine)
    if (prerequisite.required && !prerequisite.met) {
      throw new Error(
        'Complete the required prerequisite service before requesting this one.',
      )
    }

    const existing = mine.filter((request) => request.serviceCode === input.serviceCode)
    const blocking = findBlockingRequest(service, existing)
    if (blocking) {
      throw new Error(
        blocking.status === 'completed'
          ? 'You have already completed this service. Contact the career team to request it again.'
          : 'You already have an open request for this service.',
      )
    }

    const now = new Date().toISOString()
    const selfServiceResult = service.selfService ? (input.result ?? null) : null

    const request: CareerServiceRequest = {
      id: crypto.randomUUID(),
      candidateId: input.candidateId,
      serviceCode: service.code,
      status: selfServiceResult ? 'completed' : initialStatusFor(service),
      paymentStatus: initialPaymentStatusFor(service),
      candidateInput: input.candidateInput,
      candidateNotes: input.candidateNotes?.trim() || null,
      adminMessage: null,
      internalNotes: null,
      assignedTo: null,
      result: selfServiceResult,
      scheduledAt: null,
      submittedAt: now,
      completedAt: selfServiceResult ? now : null,
      updatedAt: now,
    }
    db.careerServiceRequests.push(request)

    if (selfServiceResult) {
      notifyCareerCandidate(
        db,
        request,
        'career_service_completed',
        service.name + ' completed',
        selfServiceResult.summary,
        'normal',
      )
    } else {
      notifyCareerCandidate(
        db,
        request,
        'career_service_requested',
        'Service request received',
        'Your ' + service.name + ' request was received.',
        'normal',
      )
      notifyCareerStaff(
        db,
        request,
        'New career service request',
        service.name + ' requested by a candidate.',
      )
    }

    saveDb(db)
    return this.getCareerServiceRequest(request.id)!
  },

  /** Candidate answering a request that is waiting on them. */
  submitCareerRequestInformation(
    requestId: string,
    candidateId: string,
    input: Record<string, string>,
    notes?: string | null,
  ): CareerServiceRequest {
    const db = loadDb()
    const idx = db.careerServiceRequests.findIndex((item) => item.id === requestId)
    if (idx === -1) throw new Error('Request not found.')
    const request = db.careerServiceRequests[idx]
    if (request.candidateId !== candidateId) throw new Error('Request not found.')
    if (request.status !== 'waiting_candidate') {
      throw new Error('This request is not waiting for your information.')
    }

    const service = requireCareerService(request.serviceCode)
    assertTransition(request.status, 'in_progress')

    const now = new Date().toISOString()
    db.careerServiceRequests[idx] = {
      ...request,
      status: 'in_progress',
      candidateInput: { ...request.candidateInput, ...input },
      candidateNotes: notes?.trim() || request.candidateNotes,
      adminMessage: null,
      updatedAt: now,
    }
    notifyCareerStaff(
      db,
      request,
      'Candidate provided information',
      'A candidate responded on their ' + service.name + ' request.',
    )
    saveDb(db)
    return this.getCareerServiceRequest(requestId)!
  },

  cancelCareerServiceRequest(requestId: string, candidateId: string): CareerServiceRequest {
    const db = loadDb()
    const idx = db.careerServiceRequests.findIndex((item) => item.id === requestId)
    if (idx === -1) throw new Error('Request not found.')
    const request = db.careerServiceRequests[idx]
    if (request.candidateId !== candidateId) throw new Error('Request not found.')
    if (!candidateCanCancel(request)) {
      throw new Error('This request can no longer be cancelled. Contact the career team.')
    }
    assertTransition(request.status, 'cancelled')

    const service = requireCareerService(request.serviceCode)
    const now = new Date().toISOString()
    db.careerServiceRequests[idx] = { ...request, status: 'cancelled', updatedAt: now }
    notifyCareerStaff(
      db,
      request,
      'Career service request cancelled',
      'A candidate cancelled their ' + service.name + ' request.',
    )
    saveDb(db)
    return this.getCareerServiceRequest(requestId)!
  },

  /** Staff transition. Every move is validated against the shared rules. */
  updateCareerServiceRequest(input: {
    requestId: string
    staffUserId: string
    status: CareerServiceRequestStatus
    scheduledAt?: string | null
    result?: CareerServiceResult | null
    adminMessage?: string | null
    internalNotes?: string | null
    paymentStatus?: CareerServiceRequest['paymentStatus']
  }): CareerServiceRequest {
    const db = loadDb()
    const staff = db.profiles.find((profile) => profile.id === input.staffUserId)
    if (!staff || staff.role !== 'admin') {
      throw new Error('Only the career team can manage service requests.')
    }

    const idx = db.careerServiceRequests.findIndex((item) => item.id === input.requestId)
    if (idx === -1) throw new Error('Request not found.')
    const request = db.careerServiceRequests[idx]
    const service = requireCareerService(request.serviceCode)

    assertTransition(request.status, input.status)

    if (input.status === 'scheduled' && !input.scheduledAt) {
      throw new Error('Choose a date and time before scheduling this session.')
    }
    if (input.status === 'completed' && !input.result?.summary?.trim()) {
      throw new Error('Add the result before completing this request.')
    }
    if (input.status === 'waiting_candidate' && !input.adminMessage?.trim()) {
      throw new Error('Explain what the candidate needs to provide.')
    }

    const now = new Date().toISOString()
    const updated: CareerServiceRequest = {
      ...request,
      status: input.status,
      scheduledAt:
        input.status === 'scheduled' ? (input.scheduledAt ?? null) : request.scheduledAt,
      result: input.result ?? request.result,
      adminMessage:
        input.adminMessage !== undefined
          ? input.adminMessage?.trim() || null
          : input.status === 'in_progress'
            ? null
            : request.adminMessage,
      internalNotes:
        input.internalNotes !== undefined
          ? input.internalNotes?.trim() || null
          : request.internalNotes,
      paymentStatus:
        input.paymentStatus ??
        (input.status === 'ready' && request.paymentStatus === 'pending'
          ? 'received'
          : request.paymentStatus),
      assignedTo: input.status === 'assigned' ? input.staffUserId : request.assignedTo,
      completedAt: input.status === 'completed' ? now : request.completedAt,
      updatedAt: now,
    }
    db.careerServiceRequests[idx] = updated

    const notification = careerCandidateNotification(
      input.status,
      service.name,
      input.adminMessage ?? null,
      input.result?.summary ?? null,
    )
    if (notification) {
      notifyCareerCandidate(
        db,
        updated,
        notification.type,
        notification.title,
        notification.message,
        input.status === 'waiting_candidate' || input.status === 'completed'
          ? 'high'
          : 'normal',
      )
    }

    saveDb(db)
    return this.getCareerServiceRequest(input.requestId)!
  },

  /* --------------------- employer & recruitment services -------------------- */

  getOrganization(organizationId: string): HrOrganization | undefined {
    return loadDb().organizations.find((item) => item.id === organizationId)
  },

  /** Service 31: HR completes the employer profile, admins verify it. */
  updateOrganizationProfile(
    organizationId: string,
    actorUserId: string,
    patch: {
      website?: string | null
      industry?: string | null
      description?: string | null
      companySize?: string | null
      location?: string | null
      contactEmail?: string | null
    },
  ): HrOrganization {
    const db = loadDb()
    const member = db.hrMembers.find((item) => item.userId === actorUserId)
    if (!member || member.organizationId !== organizationId) {
      throw new Error('You can only manage your own organization.')
    }
    const index = db.organizations.findIndex((item) => item.id === organizationId)
    if (index === -1) throw new Error('Organization not found.')

    const now = new Date().toISOString()
    db.organizations[index] = {
      ...db.organizations[index],
      ...patch,
      profileSubmittedAt: now,
    }
    notifyAdmins(db, {
      type: 'employer_profile_updated',
      title: 'Employer profile updated',
      message: `${db.organizations[index].name} updated their employer profile.`,
      entityType: 'organization',
      entityId: organizationId,
      organizationId,
      priority: 'normal',
    })
    saveDb(db)
    return db.organizations[index]
  },

  /** Services 32/33: the commercial tier is set by SEH staff, never self-served. */
  setOrganizationPlan(
    organizationId: string,
    plan: EmployerPlan,
    actorUserId: string,
  ): HrOrganization {
    const db = loadDb()
    const actor = db.profiles.find((profile) => profile.id === actorUserId)
    if (!actor || actor.role !== 'admin') {
      throw new Error('Only SEH staff can change an employer plan.')
    }
    const index = db.organizations.findIndex((item) => item.id === organizationId)
    if (index === -1) throw new Error('Organization not found.')

    db.organizations[index] = { ...db.organizations[index], plan }
    notifyOrganization(db, organizationId, {
      type: plan === 'pro' ? 'employer_plan_upgraded' : 'employer_plan_changed',
      title: plan === 'pro' ? 'Upgraded to Pro' : 'Plan updated',
      message:
        plan === 'pro'
          ? 'Your organization now has TalentVerify Pro: unlimited job posts, search and matching.'
          : 'Your organization is on the Free plan.',
      entityType: 'organization',
      entityId: organizationId,
      priority: 'high',
    })
    saveDb(db)
    return db.organizations[index]
  },

  countActiveJobsForOrganization(organizationId: string): number {
    const db = loadDb()
    const memberIds = new Set(
      db.hrMembers
        .filter((member) => member.organizationId === organizationId)
        .map((member) => member.userId),
    )
    return db.jobs.filter(
      (job) => memberIds.has(job.createdBy) && ['open', 'draft'].includes(job.status),
    ).length
  },

  /** Candidate-facing list: exclusive roles are hidden until the candidate is verified. */
  listOpenJobsForCandidate(candidateId: string): Job[] {
    const db = loadDb()
    const candidate = db.candidates.find((item) => item.userId === candidateId)
    const jobs = db.jobs
      .filter((job) => job.status === 'open')
      .map((job) => decorateJob(db, job))
    return visibleJobsForCandidate(jobs, candidate?.verificationStatus)
  },

  /* ------------------------------- job alerts ------------------------------- */

  listJobAlerts(candidateId: string): JobAlert[] {
    return loadDb()
      .jobAlerts.filter((alert) => alert.candidateId === candidateId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  createJobAlert(input: {
    candidateId: string
    name: string
    keywords: string[]
    location: string | null
    jobTypes: string[]
    tracks: JobAlert['tracks']
    exclusiveOnly: boolean
    frequency: JobAlert['frequency']
  }): JobAlert {
    const db = loadDb()
    const existing = db.jobAlerts.filter((alert) => alert.candidateId === input.candidateId)
    if (existing.length >= 5) {
      throw new Error('You can keep up to five job alerts. Delete one to add another.')
    }
    if (
      existing.some(
        (alert) => alert.name.trim().toLowerCase() === input.name.trim().toLowerCase(),
      )
    ) {
      throw new Error('You already have an alert with that name.')
    }

    const now = new Date().toISOString()
    const alert: JobAlert = {
      id: crypto.randomUUID(),
      candidateId: input.candidateId,
      name: input.name.trim(),
      keywords: input.keywords,
      location: input.location?.trim() || null,
      jobTypes: input.jobTypes,
      tracks: input.tracks,
      exclusiveOnly: input.exclusiveOnly,
      frequency: input.frequency,
      active: true,
      createdAt: now,
      updatedAt: now,
      lastMatchedAt: null,
      matchCount: 0,
    }
    db.jobAlerts.push(alert)
    saveDb(db)
    return alert
  },

  setJobAlertActive(alertId: string, candidateId: string, active: boolean): JobAlert {
    const db = loadDb()
    const index = db.jobAlerts.findIndex(
      (alert) => alert.id === alertId && alert.candidateId === candidateId,
    )
    if (index === -1) throw new Error('Alert not found.')
    db.jobAlerts[index] = {
      ...db.jobAlerts[index],
      active,
      updatedAt: new Date().toISOString(),
    }
    saveDb(db)
    return db.jobAlerts[index]
  },

  deleteJobAlert(alertId: string, candidateId: string): void {
    const db = loadDb()
    const exists = db.jobAlerts.some(
      (alert) => alert.id === alertId && alert.candidateId === candidateId,
    )
    if (!exists) throw new Error('Alert not found.')
    db.jobAlerts = db.jobAlerts.filter((alert) => alert.id !== alertId)
    saveDb(db)
  },

  /* -------------------------- employer service requests --------------------- */

  listEmployerServiceRequests(): EmployerServiceRequest[] {
    const db = loadDb()
    return db.employerServiceRequests
      .map((request) => decorateEmployerRequest(db, request))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  },

  listEmployerServiceRequestsForOrganization(
    organizationId: string,
  ): EmployerServiceRequest[] {
    const db = loadDb()
    return db.employerServiceRequests
      .filter((request) => request.organizationId === organizationId)
      .map((request) => ({
        ...decorateEmployerRequest(db, request),
        internalNotes: null,
      }))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  },

  getEmployerServiceRequest(id: string): EmployerServiceRequest | undefined {
    const db = loadDb()
    const request = db.employerServiceRequests.find((item) => item.id === id)
    return request ? decorateEmployerRequest(db, request) : undefined
  },

  createEmployerServiceRequest(input: {
    organizationId: string
    requestedBy: string
    serviceCode: string
    input: Record<string, string>
    notes?: string | null
  }): EmployerServiceRequest {
    const service = requireEmployerService(input.serviceCode)
    if (!service.active) throw new Error('This service is not currently available.')

    const db = loadDb()
    const member = db.hrMembers.find((item) => item.userId === input.requestedBy)
    if (!member || member.organizationId !== input.organizationId) {
      throw new Error('You can only request services for your own organization.')
    }

    const existing = db.employerServiceRequests.filter(
      (request) =>
        request.organizationId === input.organizationId &&
        request.serviceCode === service.code,
    )
    const blocking = service.allowsRepeatRequests
      ? existing.find((request) => !['completed', 'cancelled'].includes(request.status))
      : existing.find((request) => request.status !== 'cancelled')
    if (blocking) {
      throw new Error(
        blocking.status === 'completed'
          ? 'Your organization has already completed this service. Contact SEH to arrange it again.'
          : 'Your organization already has an open request for this service.',
      )
    }

    const now = new Date().toISOString()
    const request: EmployerServiceRequest = {
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      requestedBy: input.requestedBy,
      serviceCode: service.code,
      // Status and payment are derived here, never supplied by the client.
      status: service.pricingType === 'free' ? 'ready' : 'payment_pending',
      paymentStatus: service.pricingType === 'free' ? 'not_required' : 'pending',
      input: input.input,
      notes: input.notes?.trim() || null,
      adminMessage: null,
      internalNotes: null,
      assignedTo: null,
      result: null,
      scheduledAt: null,
      submittedAt: now,
      completedAt: null,
      updatedAt: now,
    }
    db.employerServiceRequests.push(request)

    notifyOrganization(db, input.organizationId, {
      type: 'employer_service_requested',
      title: 'Service request received',
      message: `Your ${service.name} request was received.`,
      entityType: 'employer_service_request',
      entityId: request.id,
    })
    notifyAdmins(db, {
      type: 'employer_service_request',
      title: 'New employer service request',
      message: `${service.name} requested by an employer.`,
      entityType: 'employer_service_request',
      entityId: request.id,
      organizationId: input.organizationId,
      priority: 'high',
    })
    saveDb(db)
    return this.getEmployerServiceRequest(request.id)!
  },

  cancelEmployerServiceRequest(
    requestId: string,
    actorUserId: string,
  ): EmployerServiceRequest {
    const db = loadDb()
    const index = db.employerServiceRequests.findIndex((item) => item.id === requestId)
    if (index === -1) throw new Error('Request not found.')
    const request = db.employerServiceRequests[index]
    const member = db.hrMembers.find((item) => item.userId === actorUserId)
    if (!member || member.organizationId !== request.organizationId) {
      throw new Error('Request not found.')
    }
    if (!candidateCanCancel(request)) {
      throw new Error('This request can no longer be cancelled. Contact SEH.')
    }
    assertTransition(request.status, 'cancelled')

    db.employerServiceRequests[index] = {
      ...request,
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    }
    notifyAdmins(db, {
      type: 'employer_service_request',
      title: 'Employer service request cancelled',
      message: 'An employer cancelled a service request.',
      entityType: 'employer_service_request',
      entityId: requestId,
      organizationId: request.organizationId,
    })
    saveDb(db)
    return this.getEmployerServiceRequest(requestId)!
  },

  /** Staff transition, validated by the shared Career Services rules. */
  updateEmployerServiceRequest(input: {
    requestId: string
    staffUserId: string
    status: CareerServiceRequestStatus
    scheduledAt?: string | null
    result?: CareerServiceResult | null
    adminMessage?: string | null
    internalNotes?: string | null
  }): EmployerServiceRequest {
    const db = loadDb()
    const staff = db.profiles.find((profile) => profile.id === input.staffUserId)
    if (!staff || staff.role !== 'admin') {
      throw new Error('Only SEH staff can manage employer service requests.')
    }
    const index = db.employerServiceRequests.findIndex(
      (item) => item.id === input.requestId,
    )
    if (index === -1) throw new Error('Request not found.')
    const request = db.employerServiceRequests[index]
    const service = requireEmployerService(request.serviceCode)

    assertTransition(request.status, input.status)

    if (input.status === 'scheduled' && !input.scheduledAt) {
      throw new Error('Choose a date and time before scheduling this session.')
    }
    if (input.status === 'completed' && !input.result?.summary?.trim()) {
      throw new Error('Add the result before completing this request.')
    }
    if (input.status === 'waiting_candidate' && !input.adminMessage?.trim()) {
      throw new Error('Explain what the employer needs to provide.')
    }

    const now = new Date().toISOString()
    const updated: EmployerServiceRequest = {
      ...request,
      status: input.status,
      scheduledAt:
        input.status === 'scheduled' ? (input.scheduledAt ?? null) : request.scheduledAt,
      result: input.result ?? request.result,
      adminMessage:
        input.adminMessage !== undefined
          ? input.adminMessage?.trim() || null
          : input.status === 'in_progress'
            ? null
            : request.adminMessage,
      internalNotes:
        input.internalNotes !== undefined
          ? input.internalNotes?.trim() || null
          : request.internalNotes,
      paymentStatus:
        input.status === 'ready' && request.paymentStatus === 'pending'
          ? 'received'
          : request.paymentStatus,
      assignedTo: input.status === 'assigned' ? input.staffUserId : request.assignedTo,
      completedAt: input.status === 'completed' ? now : request.completedAt,
      updatedAt: now,
    }
    db.employerServiceRequests[index] = updated

    const notice = careerCandidateNotification(
      input.status,
      service.name,
      input.adminMessage ?? null,
      input.result?.summary ?? null,
    )
    if (notice) {
      notifyOrganization(db, request.organizationId, {
        type: notice.type.replace('career_service', 'employer_service'),
        title: notice.title,
        message: notice.message,
        entityType: 'employer_service_request',
        entityId: request.id,
        priority:
          input.status === 'waiting_candidate' || input.status === 'completed'
            ? 'high'
            : 'normal',
      })
    }

    saveDb(db)
    return this.getEmployerServiceRequest(input.requestId)!
  },

  /* ------------------------ talent request shortlist ------------------------ */

  /**
   * Service 34. Only SEH staff build a shortlist, and only verified +
   * employer-visible candidates are eligible. Employers see nothing until the
   * shortlist is submitted.
   */
  addTalentRequestCandidate(input: {
    requestId: string
    candidateId: string
    staffUserId: string
    employerNote?: string | null
  }): TalentRequestShortlistItem {
    const db = loadDb()
    const staff = db.profiles.find((profile) => profile.id === input.staffUserId)
    if (!staff || staff.role !== 'admin') {
      throw new Error('Only SEH staff can build a talent shortlist.')
    }

    const request = db.employerServiceRequests.find((item) => item.id === input.requestId)
    if (!request) throw new Error('Talent request not found.')
    if (request.serviceCode !== '34') {
      throw new Error('This request does not have a talent shortlist.')
    }
    if (['completed', 'cancelled'].includes(request.status)) {
      throw new Error('This request is closed.')
    }

    // Eligibility is the same rule the whole product uses.
    const candidate = db.candidates.find((item) => item.userId === input.candidateId)
    if (!candidate) throw new Error('Candidate not found.')
    if (candidate.verificationStatus !== 'verified') {
      throw new Error('Only verified candidates can be shortlisted.')
    }
    if (!candidate.employerVisible) {
      throw new Error('This candidate is not discoverable by employers.')
    }

    const existing = db.talentRequestShortlists.filter(
      (item) => item.requestId === input.requestId,
    )
    if (existing.some((item) => item.candidateId === input.candidateId)) {
      throw new Error('This candidate is already on the shortlist.')
    }

    const item: TalentRequestShortlistItem = {
      id: crypto.randomUUID(),
      requestId: input.requestId,
      candidateId: input.candidateId,
      employerNote: input.employerNote?.trim() || null,
      rank: existing.length + 1,
      addedAt: new Date().toISOString(),
      addedBy: input.staffUserId,
    }
    db.talentRequestShortlists.push(item)
    saveDb(db)
    return decorateShortlistItem(db, item)
  },

  removeTalentRequestCandidate(
    itemId: string,
    staffUserId: string,
  ): void {
    const db = loadDb()
    const staff = db.profiles.find((profile) => profile.id === staffUserId)
    if (!staff || staff.role !== 'admin') {
      throw new Error('Only SEH staff can change a talent shortlist.')
    }
    const item = db.talentRequestShortlists.find((entry) => entry.id === itemId)
    if (!item) throw new Error('Shortlist entry not found.')

    const request = db.employerServiceRequests.find((entry) => entry.id === item.requestId)
    if (request?.shortlistSubmittedAt) {
      throw new Error('This shortlist has already been submitted to the employer.')
    }

    db.talentRequestShortlists = db.talentRequestShortlists
      .filter((entry) => entry.id !== itemId)
      .map((entry) =>
        entry.requestId === item.requestId && entry.rank > item.rank
          ? { ...entry, rank: entry.rank - 1 }
          : entry,
      )
    saveDb(db)
  },

  /** Staff view: always the full shortlist, submitted or not. */
  listTalentRequestShortlist(
    requestId: string,
    staffUserId: string,
  ): TalentRequestShortlistItem[] {
    const db = loadDb()
    const staff = db.profiles.find((profile) => profile.id === staffUserId)
    if (!staff || staff.role !== 'admin') {
      throw new Error('Only SEH staff can view a draft shortlist.')
    }
    return db.talentRequestShortlists
      .filter((item) => item.requestId === requestId)
      .map((item) => decorateShortlistItem(db, item))
      .sort((a, b) => a.rank - b.rank)
  },

  /**
   * Employer view: empty until SEH submits, and only ever for the employer's
   * own organization.
   */
  listSubmittedTalentShortlist(
    requestId: string,
    hrUserId: string,
  ): TalentRequestShortlistItem[] {
    const db = loadDb()
    const member = db.hrMembers.find((item) => item.userId === hrUserId)
    const request = db.employerServiceRequests.find((item) => item.id === requestId)
    if (!request || !member || request.organizationId !== member.organizationId) {
      throw new Error('Talent request not found.')
    }
    if (!request.shortlistSubmittedAt) return []

    return db.talentRequestShortlists
      .filter((item) => item.requestId === requestId)
      .map((item) => decorateShortlistItem(db, item))
      .sort((a, b) => a.rank - b.rank)
  },

  /** Releases the shortlist to the employer and notifies them. */
  submitTalentRequestShortlist(
    requestId: string,
    staffUserId: string,
  ): EmployerServiceRequest {
    const db = loadDb()
    const staff = db.profiles.find((profile) => profile.id === staffUserId)
    if (!staff || staff.role !== 'admin') {
      throw new Error('Only SEH staff can submit a talent shortlist.')
    }
    const index = db.employerServiceRequests.findIndex((item) => item.id === requestId)
    if (index === -1) throw new Error('Talent request not found.')
    const request = db.employerServiceRequests[index]
    if (request.serviceCode !== '34') {
      throw new Error('This request does not have a talent shortlist.')
    }
    if (request.shortlistSubmittedAt) {
      throw new Error('This shortlist has already been submitted.')
    }
    const count = db.talentRequestShortlists.filter(
      (item) => item.requestId === requestId,
    ).length
    if (count === 0) {
      throw new Error('Add at least one candidate before submitting the shortlist.')
    }

    const now = new Date().toISOString()
    db.employerServiceRequests[index] = {
      ...request,
      shortlistSubmittedAt: now,
      updatedAt: now,
    }
    notifyOrganization(db, request.organizationId, {
      type: 'talent_request_shortlist_submitted',
      title: 'Your shortlist is ready',
      message: `SEH submitted ${count} candidate(s) for your talent request.`,
      entityType: 'employer_service_request',
      entityId: requestId,
      priority: 'high',
    })
    saveDb(db)
    return this.getEmployerServiceRequest(requestId)!
  },

  /* ---------------------------- partnership (36) ---------------------------- */

  setOrganizationPartnership(input: {
    organizationId: string
    staffUserId: string
    status: PartnershipStatus | null
    startDate: string | null
    endDate: string | null
    notes: string | null
  }): HrOrganization {
    const db = loadDb()
    const staff = db.profiles.find((profile) => profile.id === input.staffUserId)
    if (!staff || staff.role !== 'admin') {
      throw new Error('Only SEH staff can manage a partnership.')
    }
    const index = db.organizations.findIndex((item) => item.id === input.organizationId)
    if (index === -1) throw new Error('Organization not found.')

    const previous = db.organizations[index]
    db.organizations[index] = {
      ...previous,
      partnershipStatus: input.status,
      partnershipStartDate: input.startDate,
      partnershipEndDate: input.endDate,
      partnershipNotes: input.notes?.trim() || null,
    }

    if (previous.partnershipStatus !== input.status && input.status === 'active') {
      notifyOrganization(db, input.organizationId, {
        type: 'employer_partnership_active',
        title: 'SEH Talent Partnership active',
        message: 'Your organization is now an active SEH Talent Partner.',
        entityType: 'organization',
        entityId: input.organizationId,
        priority: 'high',
      })
    }

    saveDb(db)
    return db.organizations[index]
  },

  /** Sets or clears the signed-in user's profile photo. */
  setProfileAvatar(userId: string, avatarUrl: string | null): Profile {
    const db = loadDb()
    const index = db.profiles.findIndex((profile) => profile.id === userId)
    if (index === -1) throw new Error('Profile not found.')
    db.profiles[index] = { ...db.profiles[index], avatarUrl }
    saveDb(db)
    // Keep the HR-facing directory row in step.
    if (db.profiles[index].role === 'candidate') {
      this.syncCandidateRecord(userId)
    }
    return db.profiles[index]
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

  getHrOrgs(): HrOrganization[] {
    return loadDb().organizations
  },

  reviewHrOrg(orgId: string, approved: boolean) {
    const db = loadDb()
    const idx = db.organizations.findIndex((o) => o.id === orgId)
    if (idx === -1) throw new Error('Organization not found')
    db.organizations[idx].status = approved ? 'approved' : 'rejected'
    db.organizations[idx].approvedAt = approved
      ? new Date().toISOString()
      : null
    const org = db.organizations[idx]
    const now = new Date().toISOString()
    db.notifications.push(
      ...db.hrMembers
        .filter((member) => member.organizationId === orgId)
        .map((member) => ({
          id: crypto.randomUUID(),
          recipientUserId: member.userId,
          recipientRole: 'hr' as const,
          recipientOrganizationId: orgId,
          type: approved ? 'hr_organization_approved' : 'hr_organization_rejected',
          title: approved ? 'Organization approved' : 'Organization review update',
          message: approved
            ? 'Your organization account has been approved.'
            : 'Your organization account was reviewed. Please check your status.',
          entityType: 'organization',
          entityId: orgId,
          isRead: false,
          priority: 'high' as const,
          createdAt: now,
        })),
    )
    db.notifications.push(
      ...db.profiles
        .filter((profile) => profile.role === 'admin')
        .map((admin) => ({
          id: crypto.randomUUID(),
          recipientUserId: admin.id,
          recipientRole: 'admin' as const,
          recipientOrganizationId: orgId,
          type: approved ? 'hr_organization_approved_admin' : 'hr_organization_rejected_admin',
          title: approved ? 'HR organization approved' : 'HR organization rejected',
          message: `${org.name} was ${approved ? 'approved' : 'rejected'}.`,
          entityType: 'organization',
          entityId: orgId,
          isRead: false,
          priority: 'normal' as const,
          createdAt: now,
        })),
    )
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
