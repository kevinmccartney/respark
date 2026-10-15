import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));
// Env files live at the repo root (.env.local, .env.<ENV>), shared by every app.
const envDir = path.resolve(dirname, '../..');

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, 'VITE_');
  if (mode === 'production' && !env.VITE_CLERK_PUBLISHABLE_KEY?.trim()) {
    throw new Error(
      'Missing VITE_CLERK_PUBLISHABLE_KEY. Set the GitHub Environment variable, or the repo-root .env.local locally.',
    );
  }

  return {
    envDir,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@respark-client': path.resolve(dirname, './src'),
      },
    },
    server: {
      // Reachable from the host when Vite runs in a container (Docker Compose).
      host: true,
      port: 5173,
    },
  };
});
