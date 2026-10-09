import { MakerAppImage } from '@reforged/maker-appimage';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';

const config: ForgeConfig = {
  packagerConfig: {
    name: 'Agzos Tab',
    executableName: 'agzos-tab',
    appBundleId: 'dev.agzos.tab',
    appCategoryType: 'public.app-category.productivity',
    asar: true,
    // Ships the generated icons next to the packaged app so the tray and window
    // icon resolve identically in dev and in production.
    extraResource: ['./resources/icons'],
  },
  rebuildConfig: {},
  makers: [
    // Windows — NSIS installer (.exe). MSI is intentionally not configured.
    new MakerSquirrel({
      name: 'agzos_tab',
    }),
    // macOS — .dmg installer plus a portable .app zipped build.
    new MakerDMG({ format: 'ULFO' }, ['darwin']),
    new MakerZIP({}, ['darwin']),
    // Linux — AppImage plus .deb and .rpm packages.
    new MakerAppImage({
      options: {
        // Categories per the Freedesktop spec.
        categories: ['Utility', 'Office'],
      },
    }),
    new MakerDeb({
      options: {
        name: 'agzos-tab',
        productName: 'Agzos Tab',
        categories: ['Utility', 'Office'],
      },
    }),
    new MakerRpm({
      options: {
        name: 'agzos-tab',
        productName: 'Agzos Tab',
        categories: ['Utility', 'Office'],
      },
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Keep Electron fuses locked down for shipped binaries.
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
