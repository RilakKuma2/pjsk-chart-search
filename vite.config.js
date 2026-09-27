import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { chartRoutes } from './scripts/chart-routes.mjs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [chartRoutes(), react()],
  build: {
    rollupOptions: {
      preserveEntrySignatures: 'strict',
      input: { index: 'index.html', 'chart-capture': 'src/chart-capture.js' },
      output: {
        entryFileNames: chunk => chunk.name === 'chart-capture' ? 'chart-capture.js' : 'assets/[name]-[hash].js',
      },
    },
  },
  server: {
    port: 6132,
    host: '0.0.0.0',
  },
})
