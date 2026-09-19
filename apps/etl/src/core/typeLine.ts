/** True when any `//`-separated face is a bare "Card" (art/theme backs, token extras). */
export const isNonPlayableTypeLine = (typeLine: string | null | undefined): boolean => {
  if (!typeLine) return false;
  return typeLine.split('//').some((face) => face.trim() === 'Card');
};
