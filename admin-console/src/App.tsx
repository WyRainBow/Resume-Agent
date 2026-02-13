import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorLogsPage from './pages/ErrorLogsPage'
import LoginPage from './pages/LoginPage'
import MembersPage from './pages/MembersPage'
import OverviewPage from './pages/OverviewPage'
import PermissionsPage from './pages/PermissionsPage'
import RequestLogsPage from './pages/RequestLogsPage'
import TraceDetailPage from './pages/TraceDetailPage'
import TracesPage from './pages/TracesPage'
import UsersPage from './pages/UsersPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="logs/requests" element={<RequestLogsPage />} />
          <Route path="logs/errors" element={<ErrorLogsPage />} />
          <Route path="traces" element={<TracesPage />} />
          <Route path="traces/:traceId" element={<TraceDetailPage />} />
          <Route path="permissions" element={<PermissionsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
