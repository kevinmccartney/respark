/** Terminal progress for long ETL runs (stderr so it stays clear of pino). */

export type ProgressSnapshot = {
  /** Primary counter (compressed bytes downloaded, or cards when --limit). */
  current: number
  /** Known total, or null for indeterminate. */
  total: number | null
  cards: number
  inserted: number
  updated: number
  unchanged: number
  failed: number
}

export type ProgressLogger = {
  info: (obj: Record<string, unknown>, msg?: string) => void
}

function formatRate(cardsPerSec: number): string {
  if (!Number.isFinite(cardsPerSec) || cardsPerSec <= 0) return '—'
  if (cardsPerSec >= 100) return `${Math.round(cardsPerSec)}/s`
  return `${cardsPerSec.toFixed(1)}/s`
}

function formatEta(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '—'
  if (seconds < 60) return `${Math.ceil(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.ceil(seconds % 60)
  if (m < 60) return `${m}m${String(s).padStart(2, '0')}s`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return `${h}h${String(rm).padStart(2, '0')}m`
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)}KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)}MB`
  return `${(n / 1024 ** 3).toFixed(2)}GB`
}

function formatCount(n: number): string {
  return n.toLocaleString('en-US')
}

export class ProgressBar {
  private readonly startedAt = Date.now()
  private lastRenderAt = 0
  private lastLogAt = 0
  private lastProgressEmitAt = 0
  private readonly tty: boolean
  private closed = false

  constructor(
    private readonly label: string,
    private readonly mode: 'bytes' | 'cards',
    private readonly logger?: ProgressLogger,
    private readonly out: NodeJS.WritableStream = process.stderr,
    private readonly onProgress?: (snap: ProgressSnapshot & { percent: number | null }) => void,
  ) {
    this.tty = Boolean(
      (out as NodeJS.WriteStream).isTTY && process.env.CI !== 'true',
    )
  }

  update(snap: ProgressSnapshot, force = false): void {
    if (this.closed) return
    const now = Date.now()
    const elapsedSec = Math.max((now - this.startedAt) / 1000, 0.001)
    const cardsPerSec = snap.cards / elapsedSec

    let pct: number | null = null
    let etaSec: number | null = null
    if (snap.total !== null && snap.total > 0) {
      pct = Math.min(100, (snap.current / snap.total) * 100)
      const remaining = Math.max(snap.total - snap.current, 0)
      const rate = snap.current / elapsedSec
      etaSec = rate > 0 ? remaining / rate : null
    }

    if (this.onProgress && (force || now - this.lastProgressEmitAt >= 1000)) {
      this.lastProgressEmitAt = now
      this.onProgress({
        ...snap,
        percent: pct === null ? null : Number(pct.toFixed(1)),
      })
    }

    if (this.tty) {
      if (!force && now - this.lastRenderAt < 200) return
      this.lastRenderAt = now

      const width = 24
      let bar: string
      if (pct === null) {
        const spin = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
        const frame = spin[Math.floor(now / 80) % spin.length]
        bar = `${frame} ${'░'.repeat(width)}`
      } else {
        const filled = Math.round((pct / 100) * width)
        bar = `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`
      }

      const primary =
        this.mode === 'bytes' && snap.total !== null
          ? `${formatBytes(snap.current)}/${formatBytes(snap.total)}`
          : this.mode === 'cards' && snap.total !== null
            ? `${formatCount(snap.current)}/${formatCount(snap.total)}`
            : formatCount(snap.cards)

      const pctLabel = pct === null ? '  ?%' : `${pct.toFixed(0).padStart(3)}%`
      const line =
        `${this.label} [${bar}] ${pctLabel} ${primary}` +
        ` │ ${formatCount(snap.cards)} cards @ ${formatRate(cardsPerSec)}` +
        ` │ ETA ${formatEta(etaSec)}` +
        ` │ +${formatCount(snap.inserted)} ~${formatCount(snap.unchanged)} ✗${formatCount(snap.failed)}`

      this.out.write(`\r\x1b[K${line}`)
      return
    }

    // Non-TTY / CI: periodic structured logs
    if (!this.logger) return
    if (!force && now - this.lastLogAt < 5_000) return
    this.lastLogAt = now
    this.logger.info(
      {
        event: 'etl.progress',
        label: this.label,
        cards: snap.cards,
        inserted: snap.inserted,
        updated: snap.updated,
        unchanged: snap.unchanged,
        failed: snap.failed,
        percent: pct === null ? null : Number(pct.toFixed(1)),
        cardsPerSec: Number(cardsPerSec.toFixed(1)),
        etaSeconds: etaSec === null ? null : Math.ceil(etaSec),
        current: snap.current,
        total: snap.total,
        mode: this.mode,
      },
      `${this.label} progress`,
    )
  }

  /** Finish the bar and move to the next line. */
  done(snap?: ProgressSnapshot): void {
    if (this.closed) return
    if (snap) this.update(snap, true)
    if (this.tty) this.out.write('\n')
    this.closed = true
  }
}

/** Count compressed bytes as they flow through a web ReadableStream. */
export function tapByteStream(
  body: ReadableStream<Uint8Array>,
  onBytes: (totalBytes: number) => void,
): ReadableStream<Uint8Array> {
  let total = 0
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        total += chunk.byteLength
        onBytes(total)
        controller.enqueue(chunk)
      },
    }),
  )
}
