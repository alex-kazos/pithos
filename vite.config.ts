import { defineConfig } from 'vite';

// During `npm run dev` the API server (server/index.ts) runs on its own
// port. Proxying /api to it means the browser sees a single origin - the
// same as in production, where the Node server serves the app as well.
export default defineConfig({
  server: {
    proxy: {
      '/api': { target: `http://localhost:${process.env.PORT || 3000}` },
    },
  },
});
