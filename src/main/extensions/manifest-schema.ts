import { z } from 'zod';

const moduleCapabilities = [
  'commands:register',
  'applications:read',
  'history:read',
  'history:write',
  'favorites:read',
  'favorites:write',
  'settings:read',
  'settings:write',
  'clipboard:read',
  'clipboard:write',
  'shell:open-path',
  'shell:open-external',
  'notifications',
  'ai:invoke',
] as const;

/** Strict schema: unknown manifest fields are rejected rather than ignored. */
export const moduleManifestSchema = z
  .object({
    id: z
      .string()
      .min(3)
      .max(64)
      .regex(
        /^[a-z0-9][a-z0-9.-]*$/,
        'Manifest id must be lowercase alphanumeric with dots/dashes',
      ),
    name: z.string().min(1).max(80),
    version: z.string().regex(/^\d+\.\d+\.\d+/, 'version must be semver-like'),
    description: z.string().max(280),
    category: z.enum([
      'application',
      'navigation',
      'system',
      'tools',
      'developer',
      'integration',
      'ai',
      'settings',
    ]),
    engine: z.string().max(64).optional(),
    capabilities: z.array(z.enum(moduleCapabilities)).max(moduleCapabilities.length),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type ValidatedModuleManifest = z.infer<typeof moduleManifestSchema>;
