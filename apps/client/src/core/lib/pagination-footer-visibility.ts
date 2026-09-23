import { useSyncExternalStore } from 'react';

let visible = false;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => visible;

/** Publish whether the sticky pagination footer is currently on-screen. */
export const setPaginationFooterVisible = (next: boolean) => {
  if (visible === next) return;
  visible = next;
  for (const listener of listeners) listener();
};

export const usePaginationFooterVisible = () =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
