// src/shared/components/auth/PermissionGuard.jsx
import React from 'react'
import { FaLock, FaExclamationTriangle } from 'react-icons/fa'
import usePermissions from "@shared/hooks/usePermissions.js"  // ✅ ใช้ hook กลาง

/** ให้ค่าที่รับมาเป็น array เสมอ */
function toArray(val) {
  return Array.isArray(val) ? val : (val == null ? [] : [val])
}

/**
 * Props:
 * - permission: string | string[]  (สิทธิ์ที่ต้องใช้)
 * - mode: 'any' | 'all'            (มีอย่างน้อยหนึ่ง หรือ ต้องครบทุกอัน) default: 'any'
 * - fallback: ReactNode
 */
const PermissionGuard = ({ permission, mode = 'any', children, fallback = null }) => {
  const { user, hasPermission } = usePermissions()

  const allowed = hasPermission(permission, mode)

  if (!allowed) {
    if (fallback) return fallback

    const need = toArray(permission).join(', ')
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', padding: '2rem',
        textAlign: 'center', color: '#6b7280'
      }}>
        <FaLock style={{ fontSize: '4rem', marginBottom: '1rem', color: '#dc2626' }} />
        <h2 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>
          ไม่มีสิทธิ์เข้าถึง
        </h2>
        <p style={{ margin: 0, fontSize: '1rem' }}>
          คุณไม่มีสิทธิ์ในการเข้าถึงหน้านี้ กรุณาติดต่อผู้ดูแลระบบ
        </p>
        <div style={{
          marginTop: '1rem', padding: '0.75rem 1rem', backgroundColor: '#fef2f2',
          border: '1px solid #fecaca', borderRadius: '8px', display: 'flex',
          alignItems: 'center', gap: '0.5rem'
        }}>
          <FaExclamationTriangle style={{ color: '#dc2626' }} />
          <span style={{ fontSize: '0.875rem', color: '#dc2626' }}>
            ต้องการสิทธิ์: {need || '(ไม่ระบุ)'} {Array.isArray(permission) && mode === 'all' ? '(ต้องครบทุกอัน)' : ''}
          </span>
        </div>
      </div>
    )
  }

  return children
}

export default PermissionGuard

