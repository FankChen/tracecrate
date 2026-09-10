import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: '127.0.0.1' },
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts', 'src/adapters/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/core/types.ts'],
      excludeAfterRemap: false,
      reporter: ['text', 'html'],
    },
  },
})
