export const formatRelativeTime = (iso: string): string => {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return iso;
  const seconds = Math.round((Date.now() - then) / 1000);
  if (Math.abs(seconds) < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
};
