import { z } from 'zod';

export const platformInfoSchema = z.object({
  version: z.string().min(1),
});

export type PlatformInfo = z.infer<typeof platformInfoSchema>;
