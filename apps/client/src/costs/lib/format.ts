export const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);

/** `2026-10-01` → `October 2026`. Parsed as UTC so the month never shifts by time zone. */
export const formatMonth = (month: string) =>
  new Date(`${month}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
