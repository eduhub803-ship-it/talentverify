import { createBrowserRouter, Navigate } from 'react-router-dom'
import { PublicRoute, ProtectedRoute } from '@/features/auth/components/RouteGuards'
import { LandingPage } from '@/features/auth/pages/LandingPage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage'
import { CandidateLayout } from '@/features/candidate/layouts/CandidateLayout'
import { CandidateDashboard } from '@/features/candidate/pages/CandidateDashboard'
import { CandidateProfilePage } from '@/features/candidate/pages/CandidateProfilePage'
import { UploadCVPage } from '@/features/candidate/pages/UploadCVPage'
import { UploadDocumentsPage } from '@/features/candidate/pages/UploadDocumentsPage'
import { VerificationStatusPage } from '@/features/candidate/pages/VerificationStatusPage'
import { ContactRequestsPage } from '@/features/candidate/pages/ContactRequestsPage'
import { HRLayout } from '@/features/hr/layouts/HRLayout'
import { HRDashboard } from '@/features/hr/pages/HRDashboard'
import { CandidateSearchPage } from '@/features/hr/pages/CandidateSearchPage'
import { VerifiedCandidateDetailPage } from '@/features/hr/pages/VerifiedCandidateDetailPage'
import { HRCandidateFullProfilePage } from '@/features/hr/pages/HRCandidateFullProfilePage'
import { CvEvaluationPage } from '@/features/candidate/pages/CvEvaluationPage'
import { AdminLayout } from '@/features/admin/layouts/AdminLayout'
import { AdminDashboard } from '@/features/admin/pages/AdminDashboard'
import { VerificationQueuePage } from '@/features/admin/pages/VerificationQueuePage'
import { HRApprovalsPage } from '@/features/admin/pages/HRApprovalsPage'
import { ImportCandidatesPage } from '@/features/admin/pages/ImportCandidatesPage'
import { ImportedCandidatesPage } from '@/features/admin/pages/ImportedCandidatesPage'
import { CareerServicesQueuePage } from '@/features/admin/pages/CareerServicesQueuePage'
import { CareerServicesPage } from '@/features/career-services/pages/CareerServicesPage'
import { EmployerServicesQueuePage } from '@/features/admin/pages/EmployerServicesQueuePage'
import { EmployerProfilePage } from '@/features/employer/pages/EmployerProfilePage'
import { EmployerServicesPage } from '@/features/employer/pages/EmployerServicesPage'
import { HRJobsPage } from '@/features/jobs/pages/HRJobsPage'
import { CreateJobPage } from '@/features/jobs/pages/CreateJobPage'
import { HRJobDetailPage } from '@/features/jobs/pages/HRJobDetailPage'
import { CandidateJobsPage } from '@/features/jobs/pages/CandidateJobsPage'
import { LegalPagesContainer } from '@/features/shared/pages/LegalPagesContainer'
import { PrivacyPage } from '@/features/candidate/pages/PrivacyPage'
import { MyDataPage } from '@/features/candidate/pages/MyDataPage'
import { DeleteAccountPage } from '@/features/candidate/pages/DeleteAccountPage'

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  {
    element: <PublicRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/legal/:page', element: <LegalPagesContainer /> },
    ],
  },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    path: '/candidate',
    element: <ProtectedRoute role="candidate" />,
    children: [
      {
        element: <CandidateLayout />,
        children: [
          { index: true, element: <CandidateDashboard /> },
          { path: 'profile', element: <CandidateProfilePage /> },
          { path: 'upload/cv', element: <UploadCVPage /> },
          { path: 'upload/documents', element: <UploadDocumentsPage /> },
          { path: 'verification', element: <VerificationStatusPage /> },
          { path: 'contact-requests', element: <ContactRequestsPage /> },
          { path: 'cv-evaluation', element: <CvEvaluationPage /> },
          { path: 'career-services', element: <CareerServicesPage /> },
          { path: 'settings/privacy', element: <PrivacyPage /> },
          { path: 'settings/my-data', element: <MyDataPage /> },
          { path: 'settings/delete-account', element: <DeleteAccountPage /> },
        ],
      },
    ],
  },
  {
    path: '/jobs',
    element: <ProtectedRoute role="candidate" />,
    children: [
      {
        element: <CandidateLayout />,
        children: [{ index: true, element: <CandidateJobsPage /> }],
      },
    ],
  },
  {
    path: '/hr',
    element: <ProtectedRoute role="hr" />,
    children: [
      {
        element: <HRLayout />,
        children: [
          { index: true, element: <HRDashboard /> },
          { path: 'search', element: <CandidateSearchPage /> },
          { path: 'jobs', element: <HRJobsPage /> },
          { path: 'jobs/create', element: <CreateJobPage /> },
          { path: 'jobs/:id', element: <HRJobDetailPage /> },
          { path: 'candidate/:id', element: <HRCandidateFullProfilePage /> },
          { path: 'candidates/:id', element: <VerifiedCandidateDetailPage /> },
          { path: 'organization', element: <EmployerProfilePage /> },
          { path: 'services', element: <EmployerServicesPage /> },
        ],
      },
    ],
  },
  {
    path: '/admin',
    element: <ProtectedRoute role="admin" />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminDashboard /> },
          { path: 'verification-queue', element: <VerificationQueuePage /> },
          { path: 'hr-approvals', element: <HRApprovalsPage /> },
          { path: 'import-candidates', element: <ImportCandidatesPage /> },
          { path: 'imported-candidates', element: <ImportedCandidatesPage /> },
          { path: 'career-services', element: <CareerServicesQueuePage /> },
          { path: 'employer-services', element: <EmployerServicesQueuePage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
