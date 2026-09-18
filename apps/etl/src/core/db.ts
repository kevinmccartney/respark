import { config } from 'dotenv'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Pool } from 'pg'

const here = __dirname
const packageRoot = resolve(here, '../..')

/** Load env from this package only — ETL deploys separately from the API.
 * Existing process.env wins (override: false) so Compose/API-spawned jobs keep
 * their DATABASE_URL instead of apps/etl/.env pointing at localhost.
 */
export function loadEnv() {
  for (const file of ['.env', '.env.local']) {
    const path = resolve(packageRoot, file)
    if (existsSync(path)) {
      config({ path, override: false })
    }
  }
}

export function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is required. Copy apps/etl/.env.example to apps/etl/.env.',
    )
  }

  // Present only in the deployed API image, where RDS requires verified TLS.
  // Local Compose/host leave DATABASE_CA_PATH unset and connect in plaintext.
  const caPath = process.env.DATABASE_CA_PATH
  const ssl = caPath && existsSync(caPath) ? { ca: readFileSync(caPath, 'utf8') } : undefined

  return new Pool(ssl ? { connectionString, ssl } : { connectionString })
}
