export function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const rem = Math.round(seconds % 60)
  return `${minutes}m ${rem}s`
}

export function formatTimestamp(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

export function formatNumber(n: number): string {
  return n.toLocaleString()
}

export function statusClass(status: string): string {
  switch (status) {
    case 'success':
      return 'status-chip status-success'
    case 'partial_success':
      return 'status-chip status-partial'
    case 'failed':
      return 'status-chip status-failed'
    case 'running':
      return 'status-chip status-running'
    default:
      return 'status-chip'
  }
}
