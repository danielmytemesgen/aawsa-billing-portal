import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.*'],
    exclude: ['tests/**', 'tests/e2e/**', 'node_modules', '.git'],
    globals: true,
    passWithNoTests: false,
  }
})
