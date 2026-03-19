import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/asteroid-defender/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'vendor-react';
          if (id.includes('node_modules/three/')) return 'vendor-three';
          if (id.includes('node_modules/@react-three/fiber/') || id.includes('node_modules/@react-three/drei/')) return 'vendor-r3f';
          if (id.includes('node_modules/@react-three/rapier/')) return 'vendor-rapier';
          if (id.includes('node_modules/@react-three/postprocessing/') || id.includes('node_modules/postprocessing/')) return 'vendor-postprocessing';
          if (id.includes('node_modules/zustand') || id.includes('node_modules/miniplex')) return 'vendor-state';
        }
      },
    },
  },
})
