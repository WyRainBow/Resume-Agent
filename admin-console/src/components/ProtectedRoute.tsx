import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getToken, parseJwtRole } from '../lib/auth'

export default function ProtectedRoute() {
  const token = getToken()
  const role = parseJwtRole(token)
  const location = useLocation()

  if (!token) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (role !== 'admin' && role !== 'member') {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
