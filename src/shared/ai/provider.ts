/**
 * Abstract AI provider contracts.
 *
 * This module defines *only* interfaces and pure helpers. No network provider is
 * implemented in the MVP, and nothing here is required for the launcher to work.
 * Real providers (remote or local) are added later behind these contracts.
 */

export type AiProviderKind = 'remote' | 'local';

export interface AiModelDescriptor {
  id: string;
  label: string;
  /** Approximate context window, when known. */
  contextWindow?: number;
}

export interface AiPromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiRequestOptions {
  model: string;
  messages: AiPromptMessage[];
  /** Hard timeout in milliseconds. */
  timeoutMs?: number;
  /** Caller-supplied cancellation. */
  signal?: AbortSignal;
  /** When false the provider must not send any user data off-device. */
  allowRemote?: boolean;
  maxOutputTokens?: number;
}

export interface AiStreamChunk {
  delta: string;
  done: boolean;
}

export interface AiUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface AiCompletionResult {
  text: string;
  model: string;
  usage?: AiUsage;
  /** True when the response was cut short by the timeout. */
  timedOut?: boolean;
}

export interface AiProvider {
  readonly id: string;
  readonly kind: AiProviderKind;
  /** Capability probe; a disabled/unconfigured provider reports `false`. */
  isConfigured(): boolean;
  listModels(): Promise<AiModelDescriptor[]>;
  complete(options: AiRequestOptions): Promise<AiCompletionResult>;
  stream(options: AiRequestOptions): AsyncIterable<AiStreamChunk>;
}

/**
 * Privacy guard: refuses to forward a request to a remote provider unless the
 * caller explicitly opted in. Keeps "local by default" enforceable in one place.
 */
export function assertRemoteAllowed(provider: AiProvider, options: AiRequestOptions): void {
  if (provider.kind === 'remote' && options.allowRemote !== true) {
    throw new Error('Remote AI requests are disabled by the current privacy settings.');
  }
}
