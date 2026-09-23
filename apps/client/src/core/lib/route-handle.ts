/** Route `handle` fields used by the client app (React Router). */
export type AppRouteHandle = {
  /** Sticky/bottom pagination that needs extra FAB clearance. */
  hasPagination?: boolean;
};

export const routeHasPagination = (handle: unknown): boolean =>
  typeof handle === 'object' &&
  handle !== null &&
  'hasPagination' in handle &&
  (handle as AppRouteHandle).hasPagination === true;
