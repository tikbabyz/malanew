// src/hooks/usePermissions.js
import { useAuthStore } from '../store/auth.js'

/** ทำ permissions ของผู้ใช้ให้เป็น Set ของ key เสมอ */
function normalizeUserPerms(user) {
  const raw = user?.permissions ?? user?.perms ?? []
  // array: ['pos','users', ...]
  if (Array.isArray(raw)) return new Set(raw.map(String))
  // object: { pos:true, users:false, ... }
  if (raw && typeof raw === 'object') {
    return new Set(
      Object.keys(raw).filter((k) => !!raw[k])
    )
  }
  // string: 'pos,products' หรือ 'pos|products'
  if (typeof raw === 'string') {
    return new Set(
      raw.split(/[,|]/).map(s => s.trim()).filter(Boolean)
    )
  }
  return new Set()
}

/** ให้ค่าที่รับมาเป็น array เสมอ */
function toArray(val) {
  return Array.isArray(val) ? val : (val == null ? [] : [val])
}

export const usePermissions = () => {
  const { user } = useAuthStore()

  /**
   * ตรวจสิทธิ์
   * @param {string|string[]} required - สิทธิ์ที่ต้องการ
   * @param {'any'|'all'} mode - มีอย่างน้อยหนึ่ง หรือ ต้องครบทุกอัน
   */
  const hasPermission = (required, mode = 'any') => {
    // ยังไม่ล็อกอิน
    if (!user) return false
    // แอดมินผ่านทุกหน้า
    if (user.role === 'ADMIN') return true

    const need = toArray(required)
    // ถ้าไม่ระบุสิทธิ์ ถือว่าผ่าน
    if (need.length === 0) return true

    const owned = normalizeUserPerms(user)
    if (mode === 'all') {
      return need.every((p) => owned.has(p))
    }
    // any (ค่าเริ่มต้น)
    return need.some((p) => owned.has(p))
  }

  const hasAnyPermission = (permissions = []) => hasPermission(permissions, 'any')
  const hasAllPermissions = (permissions = []) => hasPermission(permissions, 'all')

  const isAdmin = () => user?.role === 'ADMIN'

  const getAvailablePermissions = () => {
    if (!user) return []
    if (user.role === 'ADMIN') return ['pos', 'products', 'users', 'announcements', 'reports', 'payments']
    return Array.from(normalizeUserPerms(user))
  }

  return {
    user,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin,
    getAvailablePermissions,
  }
}

export default usePermissions
