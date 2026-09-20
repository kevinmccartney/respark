import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, dirname, 'VITE_');
  if (mode === 'production' && !env.VITE_CLERK_PUBLISHABLE_KEY?.trim()) {
    throw new Error(
      'Missing VITE_CLERK_PUBLISHABLE_KEY. Set the GitHub Environment variable, or apps/client/.env.local locally.',
    );
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(dirname, './src'),
      },
    },
    server: {
      // Reachable from the host when Vite runs inside Compose.
      host: true,
      port: 5173,
    },
  };
});
