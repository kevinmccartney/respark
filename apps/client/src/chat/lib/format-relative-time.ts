/** Relative time label for chat history rows (e.g. "Just now", "3 days ago"). */
export const formatRelativeTime = (iso: string, now = Date.now()): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.round((now - then) / 1000);
  if (seconds < 45) return 'Just now';
  if (seconds < 90) return '1 minute ago';

  const minutes = Math.round(seconds / 60);
  if (minutes < 45) return `${minutes} minutes ago`;
  if (minutes < 90) return '1 hour ago';

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  if (hours < 42) return 'Yesterday';

  const days = Math.round(hours / 24);
  if (days < 14) return `${days} days ago`;
  if (days < 45) return 'Last month';

  const months = Math.round(days / 30);
  if (months < 18) return `${months} months ago`;

  const years = Math.round(days / 365);
  return years <= 1 ? '1 year ago' : `${years} years ago`;
};
