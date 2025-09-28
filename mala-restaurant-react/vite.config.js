import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { 
    allowedHosts: [
      ''  // 👈 เพิ่มโดเมนของคุณตรงนี้
    ],
    host: true,    // host:true = 0.0.0.0
    port: 5173 
  }
})
