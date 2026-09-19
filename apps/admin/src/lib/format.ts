export function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  return `${minutes}m ${rem}s`;
}

export function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export type StatusBadgeProps = {
  variant: 'secondary' | 'destructive' | 'outline';
  className?: string;
};

export function statusBadgeProps(status: string): StatusBadgeProps {
  switch (status) {
    case 'success':
      return { variant: 'secondary', className: 'bg-emerald-100 text-emerald-800' };
    case 'partial_success':
      return {
        variant: 'outline',
        className: 'border-amber-200 bg-amber-100 text-amber-900',
      };
    case 'failed':
      return { variant: 'destructive' };
    case 'running':
      return {
        variant: 'outline',
        className: 'border-blue-200 bg-blue-100 text-blue-800',
      };
    default:
      return { variant: 'outline' };
  }
}
