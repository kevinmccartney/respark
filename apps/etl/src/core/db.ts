import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { config } from 'dotenv';
import { Pool } from 'pg';

const envLocal = resolve(__dirname, '../../../..', '.env.local');

/** Load the repo-root .env.local for the CLI.
 * Existing process.env wins (override: false) so API-spawned jobs keep
 * their DATABASE_URL instead of .env.local pointing at localhost.
 */
export const loadEnv = () => {
  if (existsSync(envLocal)) {
    config({ path: envLocal, override: false });
  }
};

export const createPool = (): Pool => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required. Copy .env.example to .env.local at the repo root.');
  }

  // Present only in the deployed API image, where RDS requires verified TLS.
  // Local cluster/host leave DATABASE_CA_PATH unset and connect in plaintext.
  const caPath = process.env.DATABASE_CA_PATH;
  const ssl = caPath && existsSync(caPath) ? { ca: readFileSync(caPath, 'utf8') } : undefined;

  return new Pool(ssl ? { connectionString, ssl } : { connectionString });
};
