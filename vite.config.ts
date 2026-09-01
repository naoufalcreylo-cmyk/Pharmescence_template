import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    rollupOptions: {
      output: {
        // Recharts + d3 are most of the bundle and change far less often than
        // dashboard code, so splitting them keeps repeat visits on cache.
        manualChunks: {
          react: ['react', 'react-dom'],
          charts: ['recharts'],
          ui: ['lucide-react', 'framer-motion', 'date-fns', 'clsx', 'tailwind-merge'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
})
