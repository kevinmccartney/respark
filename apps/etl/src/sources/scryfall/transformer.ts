/**
 * Maps a parsed Scryfall card into canonical catalog rows.
 * Scryfall owns oracle/printing fields — MTGJSON must not overwrite these later.
 */

import { isCatalogExtra } from '../../core/catalogSkip';
import type { ScryfallCard } from './schema';

export type CanonicalSet = {
  scryfallId: string | null;
  code: string;
  name: string;
  setType: string | null;
  releasedAt: string | null;
  digital: boolean | null;
};

export type CanonicalCard = {
  oracleId: string;
  name: string;
  manaCost: string | null;
  manaValue: string | null;
  typeLine: string | null;
  oracleText: string | null;
  colors: string[] | null;
  colorIdentity: string[] | null;
  keywords: string[] | null;
  producedMana: string[] | null;
  hasColorIndicator: boolean;
  legalities: Record<string, string>;
  layout: string | null;
  reserved: boolean | null;
  edhrecRank: number | null;
  isGameChanger: boolean | null;
};

export type CanonicalFace = {
  faceIndex: number;
  name: string | null;
  manaCost: string | null;
  typeLine: string | null;
  oracleText: string | null;
  colors: string[] | null;
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
  defense: string | null;
  imageNormal: string | null;
  imageLarge: string | null;
};

export type CanonicalPrinting = {
  scryfallId: string;
  collectorNumber: string;
  language: string | null;
  rarity: string | null;
  artist: string | null;
  releasedAt: string | null;
  borderColor: string | null;
  frame: string | null;
  fullArt: boolean | null;
  textless: boolean | null;
  oversized: boolean | null;
  promo: boolean | null;
  reprint: boolean | null;
  booster: boolean | null;
  promoTypes: string[];
  finishes: string[];
  imageSmall: string | null;
  imageNormal: string | null;
  imageLarge: string | null;
  imagePng: string | null;
};

export type CanonicalIdentifier = {
  provider: string;
  externalId: string;
};

export type CanonicalRecord = {
  set: CanonicalSet;
  card: CanonicalCard;
  printing: CanonicalPrinting;
  faces: CanonicalFace[];
  identifiers: CanonicalIdentifier[];
};

const nonempty = (value: string | null | undefined): string | null =>
  value && value.length > 0 ? value : null;

const asDateOnly = (value: string | null | undefined): string | null => {
  const s = nonempty(value);
  if (!s) return null;
  return s.slice(0, 10);
};

const asManaValue = (value: number | string | null | undefined): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return nonempty(typeof value === 'string' ? value : null);
};

const asEdhrecRank = (value: number | null | undefined): number | null => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return null;
  return value;
};

const imageField = (
  images: Record<string, string> | null | undefined,
  key: string,
): string | null => nonempty(images?.[key]);

const pushProviderId = (
  identifiers: CanonicalIdentifier[],
  provider: string,
  value: number | string | undefined,
) => {
  if (typeof value === 'number' || typeof value === 'string') {
    identifiers.push({ provider, externalId: String(value) });
  }
};

/** Scryfall `color_indicator` is a color array on the card and/or faces. */
const hasColorIndicator = (card: ScryfallCard): boolean => {
  if ((card.color_indicator?.length ?? 0) > 0) return true;
  return Boolean(card.card_faces?.some((face) => (face.color_indicator?.length ?? 0) > 0));
};

/**
 * Returns null when the object should not become a catalog.card: missing oracle
 * identity, or a Scryfall extra (token, art series, plane, …).
 */
export const transformScryfallCard = (card: ScryfallCard): CanonicalRecord | null => {
  if (
    isCatalogExtra({
      layout: card.layout,
      typeLine: card.type_line,
      setType: card.set_type,
    })
  ) {
    return null;
  }

  const facesRaw = card.card_faces;
  const oracleId = nonempty(card.oracle_id) ?? nonempty(facesRaw?.[0]?.oracle_id);
  if (!oracleId) return null;

  const imageUris = card.image_uris;
  const faces: CanonicalFace[] = facesRaw
    ? facesRaw.map((face, index) => ({
        faceIndex: index,
        name: nonempty(face.name),
        manaCost: nonempty(face.mana_cost),
        typeLine: nonempty(face.type_line),
        oracleText: nonempty(face.oracle_text),
        colors: face.colors ?? null,
        power: nonempty(face.power),
        toughness: nonempty(face.toughness),
        loyalty: nonempty(face.loyalty),
        defense: nonempty(face.defense),
        imageNormal: imageField(face.image_uris, 'normal'),
        imageLarge: imageField(face.image_uris, 'large'),
      }))
    : [
        {
          faceIndex: 0,
          name: card.name,
          manaCost: nonempty(card.mana_cost),
          typeLine: nonempty(card.type_line),
          oracleText: nonempty(card.oracle_text),
          colors: card.colors ?? null,
          power: nonempty(card.power),
          toughness: nonempty(card.toughness),
          loyalty: nonempty(card.loyalty),
          defense: nonempty(card.defense),
          imageNormal: imageField(imageUris, 'normal'),
          imageLarge: imageField(imageUris, 'large'),
        },
      ];

  const identifiers: CanonicalIdentifier[] = [{ provider: 'scryfall', externalId: card.id }];
  pushProviderId(identifiers, 'tcgplayer', card.tcgplayer_id ?? card.tcgplayer_etched_id);
  pushProviderId(identifiers, 'cardmarket', card.cardmarket_id);
  pushProviderId(identifiers, 'mtgo', card.mtgo_id);

  return {
    set: {
      scryfallId: nonempty(card.set_id),
      code: card.set,
      name: card.set_name,
      setType: nonempty(card.set_type),
      releasedAt: asDateOnly(card.released_at),
      digital: card.digital ?? null,
    },
    card: {
      oracleId,
      name: card.name,
      manaCost: nonempty(card.mana_cost),
      manaValue: asManaValue(card.cmc),
      typeLine: nonempty(card.type_line),
      oracleText: nonempty(card.oracle_text),
      colors: card.colors ?? null,
      colorIdentity: card.color_identity ?? null,
      keywords: card.keywords ?? null,
      producedMana: card.produced_mana ?? null,
      hasColorIndicator: hasColorIndicator(card),
      legalities: card.legalities,
      layout: nonempty(card.layout),
      reserved: card.reserved ?? null,
      edhrecRank: asEdhrecRank(card.edhrec_rank),
      isGameChanger: card.game_changer ?? null,
    },
    printing: {
      scryfallId: card.id,
      collectorNumber: card.collector_number,
      language: nonempty(card.lang),
      rarity: nonempty(card.rarity),
      artist: nonempty(card.artist),
      releasedAt: asDateOnly(card.released_at),
      borderColor: nonempty(card.border_color),
      frame: nonempty(card.frame),
      fullArt: card.full_art ?? null,
      textless: card.textless ?? null,
      oversized: card.oversized ?? null,
      promo: card.promo ?? null,
      reprint: card.reprint ?? null,
      booster: card.booster ?? null,
      promoTypes: card.promo_types ?? [],
      finishes: card.finishes ?? [],
      imageSmall: imageField(imageUris, 'small'),
      imageNormal: imageField(imageUris, 'normal'),
      imageLarge: imageField(imageUris, 'large'),
      imagePng: imageField(imageUris, 'png'),
    },
    faces,
    identifiers,
  };
};
