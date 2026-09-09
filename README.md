# Simple Spotify Player

A browser-only Spotify player using PKCE auth and the Web Playback SDK.

## Requirements

- **Spotify Premium.** The Web Playback SDK refuses to play without it.
- **A browser with a Widevine DRM licence.** The SDK plays protected content
  through Widevine, and Spotify's licence server refuses anything else with a
  403 on `/v1/widevine-license/…`. Playback then runs for about ten seconds —
  the length of the buffer it already had — and cuts off, often skipping to
  the next track.
  - Firefox, Chrome, Edge and Safari are licensed. Firefox keeps it behind
    *Settings → General → DRM content → "Play DRM-controlled content"*.
  - **Firefox forks such as Zen are not licensed.** They ship Widevine
    inherited from Firefox, so the setting looks enabled and the plugin looks
    installed, but licence requests are refused
    ([zen-browser/desktop#4875](https://github.com/zen-browser/desktop/issues/4875)).
    Use Firefox itself or a Chromium browser to listen.

  The player detects this: if the SDK reports playing while the position stops
  advancing, it says so and points at the licence requests in the console.

## Playlist viewer limitations

The side panel lists the tracks of the playlist or album playback is coming
from, and clicking one jumps to it. Two things it cannot show, both by
Spotify's design rather than a bug here:

- **Playlists you don't own or collaborate on.** Since the
  [February 2026 API changes](https://developer.spotify.com/documentation/web-api/references/changes/february-2026),
  a playlist's items are only returned to the owner or a collaborator. That
  includes Spotify's own generated playlists — Daily Mix, Discover Weekly,
  Release Radar and editorial ones — which apps outside
  [extended quota mode](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
  cannot read at all.
- **Local files** in a playlist, which cannot be started over the Web API.

The listing uses `GET /playlists/{id}/items`; the older `/tracks` endpoint was
removed for development-mode apps on 9 March 2026 and now answers 403.

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
