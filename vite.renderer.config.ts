import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Injects a strict Content Security Policy into the production HTML only.
 * During `electron-forge start` Vite needs inline/eval for HMR, so the dev
 * document intentionally ships without a meta CSP (local dev server only).
 *
 * Note: `frame-ancestors` is intentionally omitted — it is only honoured when
 * sent as an HTTP header, and Chromium logs a warning when it appears in a
 * `<meta>` element. Framing is instead blocked at runtime by the navigation
 * guards (`setWindowOpenHandler` denies all, `will-attach-webview` is blocked).
 */
function productionCsp(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');

  return {
    name: 'agzos-production-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), productionCsp()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
    },
  },
  build: {
    sourcemap: true,
  },
});
