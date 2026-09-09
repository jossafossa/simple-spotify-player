# Simple Spotify Player

A browser-only Spotify player using PKCE auth and the Web Playback SDK.

## Requirements

- **Spotify Premium.** The Web Playback SDK refuses to play without it.
- **DRM playback enabled in the browser.** The SDK plays protected content
  through Widevine. Firefox ships with this behind a setting: if playback is
  silent while the progress bar keeps moving, turn on
  *Settings → General → DRM content → "Play DRM-controlled content"* and
  reload. Chrome, Edge and Safari have it on by default.

## Playlist viewer limitations

The side panel lists the tracks of the playlist or album playback is coming
from, and clicking one jumps to it. Two things it cannot show, both by
Spotify's design rather than a bug here:

- **Spotify's own generated playlists** — Daily Mix, Discover Weekly, Release
  Radar and editorial playlists — return 404 to apps outside
  [extended quota mode](https://developer.spotify.com/documentation/web-api/concepts/quota-modes),
  which no personal app has.
- **Local files** in a playlist, which cannot be started over the Web API.

The panel names the HTTP status behind any other failure, so an unexpected one
can be told apart from these.

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
