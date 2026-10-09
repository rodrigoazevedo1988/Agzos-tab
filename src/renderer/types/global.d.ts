import type { AgzosApi } from '@shared/api';

declare global {
  interface Window {
    agzos: AgzosApi;
  }
}

export {};
