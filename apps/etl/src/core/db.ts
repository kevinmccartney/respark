import { config } from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(here, '../..')

/** Load env from this package only — ETL deploys separately from the API. */
export function loadEnv() {
  for (const file of ['.env', '.env.local']) {
    const path = resolve(packageRoot, file)
    if (existsSync(path)) {
      config({ path, override: true })
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

  return new Pool({ connectionString })
}
