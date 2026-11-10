import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
    env: {
      // Format-valid secret so lib/crypto.ts can derive a key in unit tests.
      BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters-long',
    },
  },
});
