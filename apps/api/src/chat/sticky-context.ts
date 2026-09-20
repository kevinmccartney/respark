/**
 * Incoming `undefined` keeps the stored sticky id.
 * `null` clears it. A uuid replaces it.
 */
export const stickyUnchanged = (
  stored: string | null,
  incoming: string | null | undefined,
): boolean => incoming === undefined || incoming === stored;
