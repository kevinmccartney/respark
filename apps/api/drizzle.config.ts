import { existsSync } from 'fs';
import { resolve } from 'path';

import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

const envLocal = resolve(__dirname, '../..', '.env.local');
if (existsSync(envLocal)) {
  config({ path: envLocal, override: true });
}

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error('DATABASE_URL is required. Copy .env.example to .env.local at the repo root.');
}

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
});
