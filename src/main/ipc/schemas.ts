import { z } from 'zod';

import { settingsSchema } from '@shared/settings-schema';

/**
 * Per-channel argument schemas. Every invoke handler validates its payload
 * before touching any service, so malformed input can never reach privileged
 * code paths.
 */
export const ipcSchemas = {
  windowSetHeight: z.object({ height: z.number().finite().min(1).max(4000) }),

  commandsSearch: z.object({
    query: z.string().max(512),
    limit: z.number().int().min(1).max(50).optional(),
  }),

  commandsExecute: z.object({
    commandId: z.string().min(1).max(128),
    args: z.record(z.string(), z.unknown()).optional(),
    confirmed: z.boolean().optional(),
  }),

  applicationsSearch: z.object({ query: z.string().max(512) }),

  applicationsLaunch: z.object({ applicationId: z.string().min(1).max(128) }),

  favoritesToggle: z.object({
    id: z.string().min(1).max(128),
    kind: z.enum(['command', 'application']),
    title: z.string().min(1).max(160),
  }),

  favoritesReorder: z.object({ ids: z.array(z.string().min(1).max(128)).max(200) }),

  historyRemove: z.object({ id: z.string().min(1).max(128) }),

  /** Settings patches are validated as a deep-partial of the settings schema. */
  settingsUpdate: settingsSchema.deepPartial(),

  settingsImport: z.object({
    json: z
      .string()
      .min(2)
      .max(256 * 1024),
  }),

  shortcutRegister: z.object({ accelerator: z.string().min(1).max(64) }),
} as const;

export type IpcSchemas = typeof ipcSchemas;
