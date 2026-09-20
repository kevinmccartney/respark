import type { NavigateFunction } from 'react-router-dom';

const historyIndex = (state: unknown): number | null => {
  if (state && typeof state === 'object' && 'idx' in state && typeof state.idx === 'number') {
    return state.idx;
  }
  return null;
};

/** React Router records the stack index on history.state.idx. */
export const goBackOrHome = (navigate: NavigateFunction): void => {
  const idx = historyIndex(window.history.state);
  if (idx !== null && idx > 0) {
    navigate(-1);
    return;
  }
  navigate('/');
};
