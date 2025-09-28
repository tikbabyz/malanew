// Protected.jsx
import { Navigate, useLocation } from 'react-router-dom'
import usePermissions from '../hooks/usePermissions'


export default function Protected({ children, require }) {
  const location = useLocation()
  const { user, isAdmin, hasPermission, hasAllPermissions } = usePermissions()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  const ok = isAdmin() ||
             (Array.isArray(require)
               ? hasAllPermissions(require)
               : (require ? hasPermission(require) : true))

  if (!ok) {
    return <NoAccess required={require} />   // หน้าที่แสดง "ต้องการสิทธิ์: pos"
  }

  return children
}
