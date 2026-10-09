import type { AppInfo, SystemCapabilities } from '@shared/types/system';
import type { ApplicationsCatalog } from '../applications/catalog';
import type { Ports } from '../app/ports';
import type { FavoritesService } from '../services/favorites-service';
import type { HistoryService } from '../services/history-service';
import type { SettingsService } from '../services/settings-service';

/** Everything builtin commands are allowed to touch. */
export interface CommandServices {
  settings: SettingsService;
  history: HistoryService;
  favorites: FavoritesService;
  applications: ApplicationsCatalog;
  ports: Ports;
  /** Late-bound so version/platform data is always current. */
  appInfo: () => AppInfo;
  capabilities: () => SystemCapabilities;
}
