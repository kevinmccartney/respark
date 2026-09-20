export const tokenFromWsUrl = (rawUrl: string | undefined): string | null => {
  const url = new URL(rawUrl ?? '/', 'http://localhost');
  const token = url.searchParams.get('token')?.trim();
  return token || null;
};
