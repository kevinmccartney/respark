import type { DeckCard } from './decks.ts'

export const DECK_GROUP_MODES = ['none', 'cmc', 'type'] as const
export type DeckGroupMode = (typeof DECK_GROUP_MODES)[number]

export const DECK_GROUP_LABELS: Record<DeckGroupMode, string> = {
  none: 'None',
  cmc: 'CMC',
  type: 'Type',
}

export type DeckCardGroup = {
  key: string
  label: string
  cards: DeckCard[]
  totalQuantity: number
  /** Secondary groups (e.g. types within a CMC bucket). */
  subgroups?: DeckCardGroup[]
}

/** Card types in display order for primary type grouping. */
const TYPE_PRIORITY = [
  'Land',
  'Creature',
  'Planeswalker',
  'Battle',
  'Instant',
  'Sorcery',
  'Enchantment',
  'Artifact',
] as const

const TYPE_SORT_INDEX = new Map(
  TYPE_PRIORITY.map((type, index) => [type, index]),
)

export function groupDeckCards(
  cards: DeckCard[],
  mode: DeckGroupMode,
): DeckCardGroup[] {
  if (mode === 'none') {
    return [
      {
        key: 'all',
        label: 'Cards',
        cards: [...cards].sort(compareByName),
        totalQuantity: sumQuantity(cards),
      },
    ]
  }

  if (mode === 'cmc') {
    return groupByCmcThenType(cards)
  }

  return groupByTypeThenCmc(cards)
}

export function primaryCardType(typeLine: string | null | undefined): string {
  if (!typeLine?.trim()) return 'Other'
  const front = typeLine.split('—')[0] ?? typeLine
  for (const type of TYPE_PRIORITY) {
    if (new RegExp(`\\b${type}\\b`, 'i').test(front)) {
      return type
    }
  }
  return 'Other'
}

function groupByCmcThenType(cards: DeckCard[]): DeckCardGroup[] {
  const byCmc = bucketBy(cards, cmcGroupKey)
  const cmcKeys = [...byCmc.keys()].sort(compareCmcKeys)

  return cmcKeys.map((cmcKey) => {
    const cmcCards = byCmc.get(cmcKey) ?? []
    const byType = bucketBy(cmcCards, typeGroupKey)
    const typeKeys = [...byType.keys()].sort((a, b) => a.localeCompare(b))

    const subgroups = typeKeys.map((typeKey) => {
      const typeCards = [...(byType.get(typeKey) ?? [])].sort(compareByName)
      return {
        key: `${cmcKey}:${typeKey}`,
        label: typeGroupLabel(typeKey),
        cards: typeCards,
        totalQuantity: sumQuantity(typeCards),
      }
    })

    return {
      key: cmcKey,
      label: cmcGroupLabel(cmcKey),
      cards: subgroups.flatMap((group) => group.cards),
      totalQuantity: sumQuantity(cmcCards),
      subgroups,
    }
  })
}

function groupByTypeThenCmc(cards: DeckCard[]): DeckCardGroup[] {
  const byType = bucketBy(cards, typeGroupKey)
  const typeKeys = [...byType.keys()].sort(compareTypeKeys)

  return typeKeys.map((typeKey) => {
    const typeCards = [...(byType.get(typeKey) ?? [])].sort((a, b) => {
      const byCmc = compareCmcKeys(cmcGroupKey(a), cmcGroupKey(b))
      if (byCmc !== 0) return byCmc
      return compareByName(a, b)
    })

    return {
      key: typeKey,
      label: typeGroupLabel(typeKey),
      cards: typeCards,
      totalQuantity: sumQuantity(typeCards),
    }
  })
}

function bucketBy(
  cards: DeckCard[],
  keyOf: (card: DeckCard) => string,
): Map<string, DeckCard[]> {
  const buckets = new Map<string, DeckCard[]>()
  for (const card of cards) {
    const key = keyOf(card)
    const list = buckets.get(key)
    if (list) list.push(card)
    else buckets.set(key, [card])
  }
  return buckets
}

function typeGroupKey(card: DeckCard): string {
  return primaryCardType(card.typeLine)
}

function typeGroupLabel(key: string): string {
  if (key === 'Other') return 'Other'
  if (key === 'Sorcery') return 'Sorceries'
  if (key.endsWith('y')) return `${key.slice(0, -1)}ies`
  if (key.endsWith('s')) return key
  return `${key}s`
}

function cmcGroupKey(card: DeckCard): string {
  if (card.manaValue == null || card.manaValue === '') return 'unknown'
  const value = Number(card.manaValue)
  if (!Number.isFinite(value)) return 'unknown'
  if (Number.isInteger(value)) return String(value)
  return String(Math.round(value * 10) / 10)
}

function cmcGroupLabel(key: string): string {
  if (key === 'unknown') return 'CMC —'
  return `CMC ${key}`
}

function compareCmcKeys(a: string, b: string): number {
  if (a === 'unknown') return 1
  if (b === 'unknown') return -1
  return Number(a) - Number(b)
}

function compareTypeKeys(a: string, b: string): number {
  const ai = TYPE_SORT_INDEX.get(a as (typeof TYPE_PRIORITY)[number]) ?? 99
  const bi = TYPE_SORT_INDEX.get(b as (typeof TYPE_PRIORITY)[number]) ?? 99
  if (ai !== bi) return ai - bi
  return a.localeCompare(b)
}

function compareByName(a: DeckCard, b: DeckCard): number {
  const byName = a.name.localeCompare(b.name)
  if (byName !== 0) return byName
  return a.setCode.localeCompare(b.setCode)
}

function sumQuantity(cards: DeckCard[]): number {
  return cards.reduce((sum, card) => sum + card.quantity, 0)
}
