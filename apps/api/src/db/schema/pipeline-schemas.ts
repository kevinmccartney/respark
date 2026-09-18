import { pgSchema } from 'drizzle-orm/pg-core'

/**
 * Named schemas for the MTG data pipeline. Tables land here in later phases.
 * `app` will eventually hold users/decks (still in public for now).
 * CREATE SCHEMA statements live in the Drizzle SQL migration.
 */
export const rawSchema = pgSchema('raw')
export const catalogSchema = pgSchema('catalog')
export const marketSchema = pgSchema('market')
export const appSchema = pgSchema('app')
