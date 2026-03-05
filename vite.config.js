import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/asteroid-defender/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-three': ['three'],
          'vendor-r3f': ['@react-three/fiber', '@react-three/drei'],
          'vendor-rapier': ['@react-three/rapier'],
          'vendor-postprocessing': ['@react-three/postprocessing', 'postprocessing'],
          'vendor-state': ['zustand', 'miniplex', 'miniplex-react'],
        },
      },
    },
  },
})
