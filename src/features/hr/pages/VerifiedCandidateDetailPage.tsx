import { Navigate, useParams } from 'react-router-dom'

/** Legacy route — redirects to canonical HR full profile URL */
export function VerifiedCandidateDetailPage() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/hr/candidate/${id}`} replace />
}
