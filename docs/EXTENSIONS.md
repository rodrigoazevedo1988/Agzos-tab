# Extensions and commands

Agzos Tab is designed to grow by adding commands and modules **without modifying the core**.

> **MVP scope:** only compiled-in, trusted modules are supported. There is **no** loading of
> third-party plugins, no dynamic `import()` of untrusted code, and no plugin catalog yet.

## The command contract

A command is metadata plus a trusted handler function:

```ts
interface CommandMetadata {
  id: string; // unique, stable, namespaced (e.g. "system.date-time")
  name: string; // shown in the palette
  description: string; // one line, shown under the name
  category:
    | 'application'
    | 'navigation'
    | 'system'
    | 'tools'
    | 'developer'
    | 'integration'
    | 'ai'
    | 'settings';
  keywords: string[]; // extra search terms
  icon: string; // Lucide icon name (see src/renderer/utils/icons.tsx)
  shortcut?: string; // display-only hint
  enabled: boolean;
  source: 'builtin' | 'system' | 'module' | 'extension' | 'ai';
  riskLevel: 'safe' | 'caution' | 'destructive';
  requiresConfirmation?: boolean; // defaults to true when riskLevel === 'destructive'
}

interface CommandResult {
  success: boolean;
  message?: string;
  content?:
    | { type: 'text'; text: string }
    | { type: 'list'; items: string[] }
    | { type: 'key-value'; entries: Array<{ key: string; value: string }> };
  error?: { code: string; message: string };
  closePalette?: boolean; // close after running
  navigateTo?: 'search' | 'settings' | 'favorites' | 'history' | 'help';
}
```

**Handlers are never serialized.** Metadata travels to the renderer as JSON; the function stays in
trusted main-process code.

## Adding a builtin command

1. Add a file under `src/main/commands/builtin/` (or extend an existing one).
2. Use the helpers in `src/main/commands/define.ts`:

```ts
import { z } from 'zod';

import type { RegisteredCommand } from '@shared/types/command';
import type { CommandServices } from '../context';
import { defineCommand, failure, success, textContent } from '../define';

const schema = z.object({ text: z.string().min(1).max(10_000) });

export function createMyCommands(services: CommandServices): RegisteredCommand[] {
  return [
    defineCommand(
      {
        id: 'tools.shout',
        name: 'Shout Text',
        description: 'Uppercase the provided text',
        category: 'tools',
        keywords: ['upper', 'uppercase'],
        icon: 'Hash',
        enabled: true,
        source: 'builtin',
        riskLevel: 'safe',
      },
      async ({ args }) => {
        const parsed = schema.safeParse(args);
        if (!parsed.success) return failure('INVALID_ARGUMENT', 'text is required');
        return success('Done', { content: textContent(parsed.data.text.toUpperCase()) });
      },
    ),
  ];
}
```

3. Register it in `src/main/commands/builtin/index.ts`.

Rules:

- **Always validate arguments** with Zod inside the handler. IPC-level schemas can only validate
  the envelope, not per-command semantics.
- **Return `CommandResult`, never throw.** The executor catches throws, but a thrown error loses
  the specific code you want to surface.
- Choose `riskLevel` honestly. Mark irreversible actions `destructive` so the confirmation dialog
  is enforced by the executor.
- Do not add a command that runs a shell string. Use the ports (`shell`, `process`) so validation
  stays centralised.

## Adding a module

A module is a group of commands with a validated manifest, tracked so it can be
enabled/disabled as a unit.

```ts
import { randomUUID } from 'node:crypto';

import type { CommandModule, ModuleRegistrationContext } from '../module-registry';
import { defineCommand, success, textContent } from '../../commands/define';

export function createMyModule(): CommandModule {
  return {
    manifest: {
      id: 'core.my-module', // lowercase, dots/dashes, unique
      name: 'My Module',
      version: '1.0.0', // semver-like
      description: 'Adds useful things.',
      category: 'tools',
      capabilities: ['commands:register'],
    },

    register({ commands, declareCommand }: ModuleRegistrationContext) {
      declareCommand('my.thing');
      commands.register(
        defineCommand(
          {
            id: 'my.thing',
            name: 'My Thing',
            description: 'Does the thing',
            category: 'tools',
            keywords: [],
            icon: 'Circle',
            enabled: true,
            source: 'module',
            riskLevel: 'safe',
          },
          async () => success('Did the thing', { content: textContent(randomUUID()) }),
        ),
      );
    },
  };
}
```

Register it in `src/main/index.ts`:

```ts
modules.registerModule(createMyModule());
```

A shipped example lives in `src/main/extensions/modules/developer-module.ts`; it is covered by
`tests/unit/module-registry.test.ts`.

### Manifest validation

`src/main/extensions/manifest-schema.ts` validates manifests with Zod and is **strict**: unknown
fields are rejected rather than silently ignored. Ids must match `^[a-z0-9][a-z0-9.-]*$`, versions
must be semver-like, and `capabilities` must come from the known set.

### Capabilities and permissions

Capabilities declare what a module intends to use:

```
commands:register   applications:read   history:read    history:write
favorites:read      favorites:write     settings:read   settings:write
clipboard:read      clipboard:write     shell:open-path shell:open-external
notifications       ai:invoke
```

`context.hasCapability('…')` lets a module degrade gracefully. **These are declarations, not a
sandbox**: modules run in the main process with full privileges, so only trusted code may be
registered. Any future support for third-party modules must first define an isolation model —
separate processes or a real sandbox — before untrusted code is loaded.

### Enabling and disabling

`settings.extensions.enabled` maps module id → boolean. A module disabled at boot has its commands
disabled immediately after registration (see the regression note below). `ModuleRegistry#setEnabled`
toggles a module's commands at runtime.

> **Ordering matters:** toggling must happen _after_ `module.register()` returns. Doing it inside
> `declareCommand` is a bug, because the command does not exist yet and the module's subsequent
> `commands.register()` re-enables it. This was found by a test and fixed in 0.1.0.

## Serialized metadata and JSON

Module manifests are plain JSON-serializable data and can be persisted or displayed. Execution
functions live in code. **Never** build a mechanism that reads a JSON file and executes whatever it
contains — that is the exact pattern the architecture forbids.

## AI commands

`src/shared/ai/provider.ts` defines the contracts (`AiProvider`, models, streaming, usage,
`assertRemoteAllowed`). Real AI commands should:

1. require the `ai:invoke` capability;
2. check `settings.ai.enabled` and refuse a remote call unless the user has explicitly opted in;
3. read credentials from the OS keychain — never from settings JSON;
4. return `CommandResult`s and **never** present a simulated response as a real model output.
