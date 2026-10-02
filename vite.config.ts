/// <reference types="vitest/config" />
import path from 'node:path'
import { alphaTab } from '@coderline/alphatab-vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { createTabSearchHandler } from './server/handler.ts'

/**
 * Where the tab search service runs. Unset, the dev and preview servers
 * answer /api/tabs/ themselves, so `pnpm dev` needs nothing else; set (as in
 * docker-compose.yml), /api is proxied to that service instead.
 */
const tabSearchUrl = process.env.TAB_SEARCH_URL

const tabSearchInProcess = (): Plugin => ({
  name: 'tab-search-in-process',
  apply: () => !tabSearchUrl,
  configureServer: (server) => {
    server.middlewares.use(createTabSearchHandler())
  },
  configurePreviewServer: (server) => {
    server.middlewares.use(createTabSearchHandler())
  },
})

export default defineConfig({
  // alphaTab's plugin bundles its workers and copies the notation font and
  // sound font into the build, served from /font/ and /soundfont/.
  plugins: [react({ compiler: true }), alphaTab(), tabSearchInProcess()],
  // Spotify's redirect URI rules reject "localhost" — must be the literal
  // loopback IP — so the dev server binds there directly.
  build: {
    // alphaTab's renderer and synthesizer are one ~1.1 MB chunk, loaded only
    // when a tab is first opened; the app's own bundle stays small.
    chunkSizeWarningLimit: 1200,
  },
  server: {
    // In a container the server has to listen beyond its own loopback; the
    // port is still only published on the host's 127.0.0.1.
    host: process.env.VITE_HOST ?? '127.0.0.1',
    proxy: tabSearchUrl ? { '/api': tabSearchUrl } : undefined,
  },
  preview: {
    host: '127.0.0.1',
  },
  resolve: {
    alias: {
      '~': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'app',
          include: ['src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          css: true,
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          include: ['server/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
})
