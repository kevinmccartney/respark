import { pgSchema } from 'drizzle-orm/pg-core'

/**
 * Named Postgres schemas. Pipeline tables live in raw/catalog/market/ops;
 * app-owned domain tables (users, decks, …) live in `app`.
 * CREATE SCHEMA statements live in the Drizzle SQL migration.
 */
export const rawSchema = pgSchema('raw')
export const catalogSchema = pgSchema('catalog')
export const marketSchema = pgSchema('market')
export const appSchema = pgSchema('app')
