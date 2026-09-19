import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { defineConfig } from 'drizzle-kit';

for (const file of ['.env', '.env.local']) {
  const path = resolve(__dirname, file);
  if (existsSync(path)) {
    config({ path, override: true });
  }
}

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error('DATABASE_URL is required. Copy apps/api/.env.example to apps/api/.env.');
}

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
});
