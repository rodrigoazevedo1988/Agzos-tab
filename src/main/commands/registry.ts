import { scoreCandidate } from '../services/search/scoring';

import type {
  CommandCategory,
  CommandHandler,
  CommandMetadata,
  RegisteredCommand,
} from '@shared/types/command';

export interface CommandSearchHit {
  metadata: CommandMetadata;
  score: number;
}

/**
 * The single authority for what the palette can execute. Handlers are trusted
 * in-process functions registered from code — never deserialised from JSON.
 */
export class CommandRegistry {
  private readonly commands = new Map<string, RegisteredCommand>();

  /** Registers a command. Throws on duplicate ids to surface wiring mistakes. */
  register(registered: RegisteredCommand): void {
    const { id } = registered.metadata;
    if (this.commands.has(id)) {
      throw new Error(`Command "${id}" is already registered`);
    }
    this.commands.set(id, registered);
  }

  registerAll(commands: RegisteredCommand[]): void {
    for (const command of commands) this.register(command);
  }

  unregister(id: string): boolean {
    return this.commands.delete(id);
  }

  get(id: string): RegisteredCommand | undefined {
    return this.commands.get(id);
  }

  has(id: string): boolean {
    return this.commands.has(id);
  }

  /** Snapshot of every registered command's metadata, sorted for stable output. */
  list(): CommandMetadata[] {
    return Array.from(this.commands.values())
      .map((entry) => ({ ...entry.metadata }))
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }

  listByCategory(): Map<CommandCategory, CommandMetadata[]> {
    const grouped = new Map<CommandCategory, CommandMetadata[]>();
    for (const metadata of this.list()) {
      const bucket = grouped.get(metadata.category) ?? [];
      bucket.push(metadata);
      grouped.set(metadata.category, bucket);
    }
    return grouped;
  }

  setEnabled(id: string, enabled: boolean): boolean {
    const current = this.commands.get(id);
    if (!current) return false;
    this.commands.set(id, { ...current, metadata: { ...current.metadata, enabled } });
    return true;
  }

  /** Scores enabled commands against a query across name/description/keywords. */
  search(query: string, limit: number): CommandSearchHit[] {
    const trimmed = query.trim();
    const hits: CommandSearchHit[] = [];

    for (const entry of this.commands.values()) {
      if (!entry.metadata.enabled) continue;
      const { metadata } = entry;
      if (trimmed.length === 0) {
        hits.push({ metadata, score: 0 });
        continue;
      }
      const score = Math.max(
        scoreCandidate(trimmed, metadata.name) * 1.5,
        scoreCandidate(trimmed, metadata.description) * 0.8,
        scoreCandidate(trimmed, metadata.keywords.join(' ')),
        scoreCandidate(trimmed, metadata.id),
      );
      if (score > 0) hits.push({ metadata, score });
    }

    return hits
      .sort((a, b) => b.score - a.score || a.metadata.name.localeCompare(b.metadata.name))
      .slice(0, Math.max(0, limit));
  }

  resolveHandler(id: string): CommandHandler | undefined {
    const entry = this.commands.get(id);
    if (!entry || !entry.metadata.enabled) return undefined;
    return entry.handler;
  }

  get size(): number {
    return this.commands.size;
  }
}
