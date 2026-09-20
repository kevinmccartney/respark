export const IDS = {
  deck: '00000000-0000-4000-8000-000000000001',
  commanderCard: '00000000-0000-4000-8000-000000000002',
  commanderPrinting: '00000000-0000-4000-8000-000000000003',
  solRing: '00000000-0000-4000-8000-000000000004',
  counterspell: '00000000-0000-4000-8000-000000000005',
  cultivate: '00000000-0000-4000-8000-000000000006',
  rhystic: '00000000-0000-4000-8000-000000000007',
  bolt: '00000000-0000-4000-8000-000000000008',
  birds: '00000000-0000-4000-8000-000000000009',
} as const;

export type FixtureCard = {
  id: string;
  name: string;
  manaCost: string | null;
  manaValue: string | null;
  typeLine: string | null;
  oracleText: string | null;
  colorIdentity: string[];
  legalities: Record<string, string>;
};

export const FIXTURE_CARDS: FixtureCard[] = [
  {
    id: IDS.solRing,
    name: 'Sol Ring',
    manaCost: '{1}',
    manaValue: '1',
    typeLine: 'Artifact',
    oracleText: '{T}: Add {C}{C}.',
    colorIdentity: [],
    legalities: { commander: 'legal', standard: 'not_legal', modern: 'not_legal' },
  },
  {
    id: IDS.counterspell,
    name: 'Counterspell',
    manaCost: '{U}{U}',
    manaValue: '2',
    typeLine: 'Instant',
    oracleText: 'Counter target spell.',
    colorIdentity: ['U'],
    legalities: { commander: 'legal', standard: 'not_legal', modern: 'legal' },
  },
  {
    id: IDS.cultivate,
    name: 'Cultivate',
    manaCost: '{2}{G}',
    manaValue: '3',
    typeLine: 'Sorcery',
    oracleText: 'Search for a basic land.',
    colorIdentity: ['G'],
    legalities: { commander: 'legal', standard: 'not_legal', modern: 'not_legal' },
  },
  {
    id: IDS.rhystic,
    name: 'Rhystic Study',
    manaCost: '{2}{U}',
    manaValue: '3',
    typeLine: 'Enchantment',
    oracleText: 'Draw whenever a spell is cast unless they pay {1}.',
    colorIdentity: ['U'],
    legalities: { commander: 'legal', standard: 'not_legal', modern: 'not_legal' },
  },
  {
    id: IDS.bolt,
    name: 'Lightning Bolt',
    manaCost: '{R}',
    manaValue: '1',
    typeLine: 'Instant',
    oracleText: 'Lightning Bolt deals 3 damage to any target.',
    colorIdentity: ['R'],
    legalities: { commander: 'legal', standard: 'legal', modern: 'legal' },
  },
  {
    id: IDS.birds,
    name: 'Birds of Paradise',
    manaCost: '{G}',
    manaValue: '1',
    typeLine: 'Creature — Bird',
    oracleText: 'Flying, {T}: Add one mana of any color.',
    colorIdentity: ['G'],
    legalities: { commander: 'legal', standard: 'not_legal', modern: 'legal' },
  },
];

export const cardMatchesSearchFilters = (
  card: FixtureCard,
  opts: {
    colorIdentity?: string[];
    legalIn?: string;
    typeContains?: string;
    maxManaValue?: number;
    excludeCardIds?: string[];
    q?: string;
  },
): boolean => {
  if (opts.excludeCardIds?.includes(card.id)) return false;
  if (opts.legalIn && card.legalities[opts.legalIn] !== 'legal') return false;
  if (opts.colorIdentity) {
    const allowed = new Set(opts.colorIdentity);
    if (!card.colorIdentity.every((pip) => allowed.has(pip))) return false;
  }
  if (
    opts.typeContains &&
    !(card.typeLine ?? '').toLowerCase().includes(opts.typeContains.toLowerCase())
  ) {
    return false;
  }
  if (opts.maxManaValue !== undefined) {
    const n = Number(card.manaValue);
    if (!Number.isFinite(n) || n > opts.maxManaValue) return false;
  }
  if (opts.q) {
    const hay = `${card.name} ${card.typeLine ?? ''} ${card.oracleText ?? ''}`.toLowerCase();
    if (!hay.includes(opts.q.toLowerCase())) return false;
  }
  return true;
};
