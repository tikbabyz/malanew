// src/store/auth.js
import { create } from 'zustand'
import API from '@services/api'

const AUTH_KEY = 'mala_auth_user'

export const useAuthStore = create((set, get) => ({
  user: (() => {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null') } catch { return null }
  })(),
  isLoading: false,

  setUser: (user) => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user))
    set({ user, isLoading: false })
  },

  login: async ({ username, password }) => {
    // เผื่อมีคนเรียก store ตรง ๆ โดยไม่ trim
    const u = String(username || '').trim()
    const p = String(password || '').trim()

    set({ isLoading: true })
    try {
      const res = await API.login(u, p)

      const userProfile = {
        id: res.id,
        username: res.username,
        role: res.role,
        name: res.name,
        // เก็บทั้งสองคีย์ให้ส่วนอื่นอ่านได้หมด
        permissions: res.permissions ?? res.perms ?? [],
        perms: res.perms ?? undefined,
      }
      const { setUser } = get()
      setUser(userProfile)
      return userProfile

    } catch (apiError) {
      console.warn('⚠️ API login failed:', apiError?.message)

      // error ประเภท credential → โยนคืนไปให้ Login.jsx จัดการใต้ช่อง
      const msg = String(apiError?.message || '').toLowerCase()
      const isCred =
        msg.includes('รหัสผ่าน') ||
        msg.includes('password') ||
        msg.includes('ไม่พบ') ||
        msg.includes('ผู้ใช้') ||
        msg.includes('บัญชี') ||
        msg.includes('user not found')

      if (isCred) {
        throw apiError
      }

      // อื่น ๆ → fallback โหมดออฟไลน์
      try {
        const raw = localStorage.getItem('mala_data_v1')
        if (!raw) throw new Error('ไม่พบข้อมูลผู้ใช้ในระบบ (โหมดออฟไลน์)')

        const data = JSON.parse(raw)
        const users = data.users || []
        const localUser = users.find(
          x => x.username === u && x.password === p && x.active === true
        )
        if (!localUser) throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (โหมดออฟไลน์)')

        const userProfile = {
          id: localUser.id,
          username: localUser.username,
          role: localUser.role,
          name: localUser.name,
          permissions: localUser.permissions || localUser.perms || [],
          perms: localUser.perms ?? undefined,
        }
        const { setUser } = get()
        setUser(userProfile)
        return userProfile
      } catch (localError) {
        // โยนให้ UI แสดงข้อความรวม
        throw localError
      }
    } finally {
      set({ isLoading: false })
    }
  },

  logout: () => {
    localStorage.removeItem(AUTH_KEY)
    set({ user: null, isLoading: false })
  },
}))

