/// <reference types="vitest/config" />
import path from 'node:path'
import { alphaTab } from '@coderline/alphatab-vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // alphaTab's plugin bundles its workers and copies the notation font and
  // sound font into the build, served from /font/ and /soundfont/.
  plugins: [react({ compiler: true }), alphaTab()],
  // Spotify's redirect URI rules reject "localhost" — must be the literal
  // loopback IP — so the dev server binds there directly.
  build: {
    // alphaTab's renderer and synthesizer are one ~1.1 MB chunk, loaded only
    // when a tab is first opened; the app's own bundle stays small.
    chunkSizeWarningLimit: 1200,
  },
  server: {
    host: '127.0.0.1',
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
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
