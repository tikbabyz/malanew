// src/store/auth.js
import { create } from 'zustand'
import API from '../services/api'

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
    console.log('🔑 Auth store login called with:', { username, passwordLength: password.length });
    
    set({ isLoading: true });
    
    try {
      console.log('🌐 Attempting API login...');
      
      // ลองเรียก API ก่อน
      const response = await API.login(username, password)
      
      console.log('✅ API login successful:', response);
      
      const userProfile = { 
        id: response.id, 
        username: response.username, 
        role: response.role, 
        name: response.name, 
        permissions: response.perms || response.permissions || [] 
      }
      
      console.log('💾 Saving user to store:', userProfile);
      
      // บันทึกข้อมูลผู้ใช้ลง localStorage และ state
      const { setUser } = get()
      setUser(userProfile)
      
      return userProfile
    } catch (apiError) {
      console.warn('⚠️ API login failed, trying localStorage fallback:', apiError.message);
      
      // ถ้า API fail ให้ fallback ไปใช้ localStorage
      try {
        console.log('💾 Attempting localStorage fallback...');
        
        const dataKey = 'mala_data_v1'
        const dataRaw = localStorage.getItem(dataKey)
        
        console.log('📂 localStorage data exists:', !!dataRaw);
        
        if (!dataRaw) {
          throw new Error('ไม่พบข้อมูลผู้ใช้ในระบบ')
        }
        
        const data = JSON.parse(dataRaw)
        const users = data.users || []
        
        console.log('👥 Found users in localStorage:', users.length);
        
        const user = users.find(u => 
          u.username === username && 
          u.password === password && 
          u.active === true
        )
        
        console.log('🔍 User found in localStorage:', !!user);
        
        if (!user) {
          throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
        }
        
        console.log('✅ localStorage user found:', user.username);
        
        const userProfile = { 
          id: user.id, 
          username: user.username, 
          role: user.role, 
          name: user.name, 
          permissions: user.permissions || [] 
        }
        
        console.log('💾 Saving localStorage user to store:', userProfile);
        
        // บันทึกข้อมูลผู้ใช้ลง localStorage และ state สำหรับ fallback
        const { setUser } = get()
        setUser(userProfile)
        
        return userProfile
      } catch (localError) {
        console.error('❌ localStorage fallback failed:', localError);
        set({ isLoading: false });
        throw new Error('เกิดข้อผิดพลาดในการเข้าสู่ระบบ: ' + (localError.message || localError))
      }
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    console.log('🚪 Logout called - clearing user data');
    localStorage.removeItem(AUTH_KEY)
    set({ user: null, isLoading: false })
  },
}))
