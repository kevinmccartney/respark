import type { GlobalFlags } from './types';

export const resolveStoreRaw = (flags: GlobalFlags): boolean => {
  if (flags.storeRaw !== undefined) return flags.storeRaw;
  return process.env.ETL_STORE_RAW !== 'false';
};
