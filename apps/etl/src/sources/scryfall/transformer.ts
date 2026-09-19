/**
 * Maps a Scryfall card object (full JSON) into canonical catalog rows.
 * Scryfall owns oracle/printing fields — MTGJSON must not overwrite these later.
 */

import { isNonPlayableTypeLine } from '../../core/typeLine';

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
  layout: string | null;
  reserved: boolean | null;
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

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const asBool = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);

const asStringArray = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const out = value.filter((v): v is string => typeof v === 'string');
  return out;
};

const asDateOnly = (value: unknown): string | null => {
  const s = asString(value);
  if (!s) return null;
  // Scryfall dates are YYYY-MM-DD or ISO timestamps
  return s.slice(0, 10);
};

const asManaValue = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.length > 0) return value;
  return null;
};

const imageField = (images: Record<string, unknown> | null, key: string): string | null =>
  images ? asString(images[key]) : null;

/**
 * Returns null when the object should not become a catalog.card: missing identity
 * fields, or a non-playable extra (a `Card` face on the type line).
 */
export const transformScryfallCard = (raw: unknown): CanonicalRecord | null => {
  const card = asRecord(raw);
  if (!card) return null;

  if (isNonPlayableTypeLine(asString(card.type_line))) {
    return null;
  }

  const scryfallId = asString(card.id);
  const setCode = asString(card.set);
  const setName = asString(card.set_name);
  const collectorNumber = asString(card.collector_number);
  const name = asString(card.name);

  const imageUris = asRecord(card.image_uris);
  const facesRaw = Array.isArray(card.card_faces) ? card.card_faces : null;

  // Reversible / some multi-face layouts omit top-level oracle_id and only put it
  // on each face (often the same id). Fall back so those printings still catalog.
  const oracleId =
    asString(card.oracle_id) ?? (facesRaw?.[0] ? asString(asRecord(facesRaw[0])?.oracle_id) : null);

  if (!oracleId || !scryfallId || !setCode || !setName || !collectorNumber || !name) {
    return null;
  }

  const faces: CanonicalFace[] = facesRaw
    ? facesRaw.flatMap((face, index) => {
        const f = asRecord(face);
        if (!f) return [];
        const faceImages = asRecord(f.image_uris);
        return [
          {
            faceIndex: index,
            name: asString(f.name),
            manaCost: asString(f.mana_cost),
            typeLine: asString(f.type_line),
            oracleText: asString(f.oracle_text),
            colors: asStringArray(f.colors),
            power: asString(f.power),
            toughness: asString(f.toughness),
            loyalty: asString(f.loyalty),
            defense: asString(f.defense),
            imageNormal: imageField(faceImages, 'normal'),
            imageLarge: imageField(faceImages, 'large'),
          },
        ];
      })
    : [
        {
          faceIndex: 0,
          name,
          manaCost: asString(card.mana_cost),
          typeLine: asString(card.type_line),
          oracleText: asString(card.oracle_text),
          colors: asStringArray(card.colors),
          power: asString(card.power),
          toughness: asString(card.toughness),
          loyalty: asString(card.loyalty),
          defense: asString(card.defense),
          imageNormal: imageField(imageUris, 'normal'),
          imageLarge: imageField(imageUris, 'large'),
        },
      ];

  const identifiers: CanonicalIdentifier[] = [{ provider: 'scryfall', externalId: scryfallId }];
  const tcgplayer = card.tcgplayer_id ?? card.tcgplayer_etched_id;
  if (typeof tcgplayer === 'number' || typeof tcgplayer === 'string') {
    identifiers.push({ provider: 'tcgplayer', externalId: String(tcgplayer) });
  }
  if (typeof card.cardmarket_id === 'number' || typeof card.cardmarket_id === 'string') {
    identifiers.push({ provider: 'cardmarket', externalId: String(card.cardmarket_id) });
  }
  if (typeof card.mtgo_id === 'number' || typeof card.mtgo_id === 'string') {
    identifiers.push({ provider: 'mtgo', externalId: String(card.mtgo_id) });
  }

  return {
    set: {
      scryfallId: asString(card.set_id),
      code: setCode,
      name: setName,
      setType: asString(card.set_type),
      releasedAt: asDateOnly(card.released_at),
      digital: asBool(card.digital),
    },
    card: {
      oracleId,
      name,
      manaCost: asString(card.mana_cost),
      manaValue: asManaValue(card.cmc),
      typeLine: asString(card.type_line),
      oracleText: asString(card.oracle_text),
      colors: asStringArray(card.colors),
      colorIdentity: asStringArray(card.color_identity),
      keywords: asStringArray(card.keywords),
      layout: asString(card.layout),
      reserved: asBool(card.reserved),
    },
    printing: {
      scryfallId,
      collectorNumber,
      language: asString(card.lang),
      rarity: asString(card.rarity),
      artist: asString(card.artist),
      releasedAt: asDateOnly(card.released_at),
      borderColor: asString(card.border_color),
      frame: asString(card.frame),
      fullArt: asBool(card.full_art),
      textless: asBool(card.textless),
      oversized: asBool(card.oversized),
      promo: asBool(card.promo),
      reprint: asBool(card.reprint),
      imageSmall: imageField(imageUris, 'small'),
      imageNormal: imageField(imageUris, 'normal'),
      imageLarge: imageField(imageUris, 'large'),
      imagePng: imageField(imageUris, 'png'),
    },
    faces,
    identifiers,
  };
};
