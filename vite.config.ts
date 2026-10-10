/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const port = Number(loadEnv(mode, process.cwd(), '').DEV_PORT || 5173)
  return {
    plugins: [react(), tailwindcss()],
    // Bind IPv4 loopback explicitly: `localhost` resolves to ::1 only on this
    // host, but the plan's browser-automation origin is http://127.0.0.1:<port>.
    server: { host: '127.0.0.1', port, strictPort: true },
    preview: { host: '127.0.0.1', port, strictPort: true },
    test: {
      environment: 'node',
      setupFiles: ['tests/unit/setup.ts'],
      include: [
        'src/**/*.test.{ts,tsx}',
        'tests/unit/**/*.test.{ts,tsx}',
        'tests/integration/**/*.test.{ts,tsx}',
      ],
      passWithNoTests: true,
    },
  }
})
