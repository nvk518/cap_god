import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/game_challenge/',
  plugins: [react()],
  // @ts-expect-error vitest adds the test key at runtime
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
