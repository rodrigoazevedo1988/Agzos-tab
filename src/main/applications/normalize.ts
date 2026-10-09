import { createHash } from 'node:crypto';

import type { ApplicationEntry, RawApplicationRecord } from '@shared/types/application';
import type { Platform } from '@shared/types/platform';

/** Stable identifier derived from the platform + canonical path. */
export function applicationId(platform: Platform, candidatePath: string): string {
  return createHash('sha1').update(`${platform}:${candidatePath}`).digest('hex').slice(0, 16);
}

const NOISE_TOKENS = /\b(app|application|desktop|launcher|shortcut)\b/gi;

/** Normalises records: trims names, builds keywords, de-duplicates by id. */
export function normalizeRecords(
  records: RawApplicationRecord[],
  platform: Platform,
): ApplicationEntry[] {
  const byId = new Map<string, ApplicationEntry>();

  for (const record of records) {
    const name = record.name.replace(/\s+/g, ' ').trim();
    if (name.length === 0 || record.path.length === 0) continue;
    const id = applicationId(platform, record.path);
    if (byId.has(id)) continue;

    const keywords = new Set<string>([name.toLowerCase()]);
    for (const keyword of record.keywords ?? []) {
      const clean = keyword.replace(/\s+/g, ' ').trim().toLowerCase();
      if (clean) keywords.add(clean);
    }
    // Add a "without noise words" variant to improve partial matching.
    const simplified = name.replace(NOISE_TOKENS, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    if (simplified) keywords.add(simplified);

    const entry: ApplicationEntry = {
      id,
      name,
      path: record.path,
      launchTarget: record.launchTarget ?? record.path,
      source: record.source,
      platform,
      keywords: Array.from(keywords),
      ...(record.iconPath ? { iconPath: record.iconPath } : {}),
    };
    byId.set(id, entry);
  }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}
