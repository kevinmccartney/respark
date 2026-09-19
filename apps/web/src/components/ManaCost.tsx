const MANA_SYMBOL_RE = /\{([^}]+)\}/g

function symbolCode(raw: string): string {
  return raw.replace(/\//g, '')
}

function symbolUrl(code: string): string {
  return `https://svgs.scryfall.io/card-symbols/${encodeURIComponent(code)}.svg`
}

export function ManaCost({
  cost,
  className,
  size = 16,
}: {
  cost: string | null | undefined
  className?: string
  size?: number
}) {
  if (!cost) return null

  const symbols = [...cost.matchAll(MANA_SYMBOL_RE)].map((match) => match[1])
  if (symbols.length === 0) {
    return (
      <span className={className} title={cost}>
        {cost}
      </span>
    )
  }

  return (
    <span
      className={className ? `inline-flex items-center gap-0.5 ${className}` : 'inline-flex items-center gap-0.5'}
      aria-label={cost}
      title={cost}
    >
      {symbols.map((symbol, index) => {
        const code = symbolCode(symbol)
        return (
          <img
            key={`${code}-${index}`}
            src={symbolUrl(code)}
            alt={symbol}
            width={size}
            height={size}
            className="inline-block"
            loading="lazy"
          />
        )
      })}
    </span>
  )
}
