import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: true },
  // 10x horizons push several ensemble-rebuild tests past vitest's 5s default
  test: { testTimeout: 30000 },
})
