import type { Column } from 'drizzle-orm';
import type { ColumnBuilderExtraConfig } from 'drizzle-orm/column-builder';
import {
  boolean,
  date,
  integer,
  numeric,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { catalogSchema } from '../pipeline-schemas';

// Keep these in scope so `declaration: true` can name inferred table types.
export type _DrizzlePortableColumn = Column;
export type _DrizzlePortableColumnBuilder = ColumnBuilderExtraConfig;

/** Conceptual / oracle identity. External key: Scryfall oracle_id. */
export const cards = catalogSchema.table('card', {
  id: uuid('id').primaryKey().defaultRandom(),
  oracleId: uuid('oracle_id').notNull().unique(),
  name: text('name').notNull(),
  manaCost: text('mana_cost'),
  manaValue: numeric('mana_value'),
  typeLine: text('type_line'),
  oracleText: text('oracle_text'),
  colors: text('colors').array(),
  colorIdentity: text('color_identity').array(),
  keywords: text('keywords').array(),
  layout: text('layout'),
  reserved: boolean('reserved'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sets = catalogSchema.table('set', {
  id: uuid('id').primaryKey().defaultRandom(),
  scryfallId: uuid('scryfall_id').unique(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  setType: text('set_type'),
  releasedAt: date('released_at'),
  cardCount: integer('card_count'),
  digital: boolean('digital'),
  parentSetCode: text('parent_set_code'),
  iconSvgUri: text('icon_svg_uri'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const printings = catalogSchema.table('printing', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id')
    .notNull()
    .references(() => cards.id, { onDelete: 'cascade' }),
  setId: uuid('set_id')
    .notNull()
    .references(() => sets.id, { onDelete: 'restrict' }),
  scryfallId: uuid('scryfall_id').notNull().unique(),
  collectorNumber: text('collector_number').notNull(),
  language: text('language'),
  rarity: text('rarity'),
  artist: text('artist'),
  releasedAt: date('released_at'),
  borderColor: text('border_color'),
  frame: text('frame'),
  fullArt: boolean('full_art'),
  textless: boolean('textless'),
  oversized: boolean('oversized'),
  promo: boolean('promo'),
  reprint: boolean('reprint'),
  finishes: text('finishes').array().notNull().default([]),
  imageSmall: text('image_small'),
  imageNormal: text('image_normal'),
  imageLarge: text('image_large'),
  imagePng: text('image_png'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cardFaces = catalogSchema.table(
  'card_face',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    printingId: uuid('printing_id')
      .notNull()
      .references(() => printings.id, { onDelete: 'cascade' }),
    faceIndex: integer('face_index').notNull(),
    name: text('name'),
    manaCost: text('mana_cost'),
    typeLine: text('type_line'),
    oracleText: text('oracle_text'),
    colors: text('colors').array(),
    power: text('power'),
    toughness: text('toughness'),
    loyalty: text('loyalty'),
    defense: text('defense'),
    imageNormal: text('image_normal'),
    imageLarge: text('image_large'),
  },
  (table) => [
    unique('card_face_printing_id_face_index_uidx').on(table.printingId, table.faceIndex),
  ],
);

export const printingIdentifiers = catalogSchema.table(
  'printing_identifier',
  {
    printingId: uuid('printing_id')
      .notNull()
      .references(() => printings.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    externalId: text('external_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.printingId, table.provider, table.externalId] }),
    unique('printing_identifier_provider_external_id_uidx').on(table.provider, table.externalId),
  ],
);
