import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const base = process.env.BASE_PATH ?? '/';

function gitCommit(): string {
  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };
const buildInfo = {
  version: pkg.version,
  commit: process.env.GITHUB_SHA?.slice(0, 12) ?? gitCommit(),
  builtAt: new Date().toISOString(),
};

export default defineConfig({
  base,
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo),
  },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'postcardmemo',
        short_name: 'postcardmemo',
        description: '明信片與持有人關聯記錄（離線）',
        theme_color: '#2563eb',
        background_color: '#f7f7f8',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192x192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'pwa-512x512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: 'pwa-512x512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
