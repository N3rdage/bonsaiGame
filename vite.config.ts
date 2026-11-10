import { execFileSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import { commitUrl, formatBuildVersion, UNKNOWN_COMMIT } from './src/buildVersion.ts';

/** `git <args>` trimmed, or undefined where git or the repository is unavailable. */
function git(args: string[]): string | undefined {
  try {
    const out = execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out === '' ? undefined : out;
  } catch {
    return undefined;
  }
}

// The version depends only on the commit and the CI run, never on when the build ran.
const commit = process.env.GITHUB_SHA ?? git(['rev-parse', 'HEAD']) ?? UNKNOWN_COMMIT;
const commitDate = git(['log', '-1', '--format=%cI']) ?? '';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(formatBuildVersion(commitDate, process.env.GITHUB_RUN_NUMBER)),
    __APP_COMMIT__: JSON.stringify(commit),
    __APP_COMMIT_URL__: JSON.stringify(commitUrl(commit)),
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Bonsai Greenhouse',
        short_name: 'Bonsai',
        description: 'A cozy bonsai-growing sim.',
        theme_color: '#3b5d3a',
        background_color: '#1d2a1c',
        display: 'standalone',
        // Phones run landscape only (src/platform/orientation.ts); the installed app opens that way.
        orientation: 'landscape',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // woff2: the self-hosted pixel font (src/scenes/textStyle.ts), so text draws in it offline.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}'],
        // Phaser alone is over a megabyte; the default 2 MB cap would silently skip it.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      output: {
        // Phaser changes rarely; keeping it in its own chunk lets browsers cache it across app updates.
        advancedChunks: {
          groups: [
            { name: 'phaser', test: 'node_modules/phaser/' },
            // Three.js likewise changes rarely and gets its own cacheable chunk.
            { name: 'three', test: 'node_modules/three/' },
          ],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/main.ts', 'src/scenes/**', 'src/viewer/TreeViewer.ts'],
    },
  },
});
