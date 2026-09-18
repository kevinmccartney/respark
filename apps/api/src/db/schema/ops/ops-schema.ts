import { pgSchema } from 'drizzle-orm/pg-core'

/**
 * ETL operational schema. Catalog/raw/market/app schemas are created in the same
 * migration; tables land there in later phases.
 */
export const opsSchema = pgSchema('ops')
