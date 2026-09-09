# Simple Spotify Player

A browser-only Spotify player using PKCE auth and the Web Playback SDK.

## Two playback modes

The toggle at the top of the player switches between them, and the choice is
remembered per browser.

- **This browser** — plays in the page through the Web Playback SDK. Needs a
  browser licensed for Widevine (see below).

  Choosing this mode only makes the browser *available* as a device; it never
  moves the music on its own. **Play here** does that, taking playback off
  whichever device holds it. Keeping the two apart means a tab opening, or a
  mode being remembered from last time, can never yank the music off a speaker
  in another room — and the click is needed regardless, since browsers refuse
  to start the SDK's audio outside a user gesture.
- **Remote** — drives Spotify running somewhere else: phone, desktop, speaker.
  Nothing is streamed here, so no DRM is involved. Playback state is polled
  from the Web API, and the device picker moves playback between devices.

The default is chosen per device: the app asks the browser for Widevine up
front and starts in remote mode when it isn't there. Because an unlicensed
Widevine build claims support and only gives itself away when Spotify refuses
it a licence, the outcome of the last licence request is remembered too and
moves that device's default — either way, so a browser that once failed is not
written off for good. An explicit choice from the toggle always wins over both.

## Component layout

`src/components/` is split by how much each component knows:

- **`ui/`** — `Card`, `Controls`, `ProgressBar`. No Spotify concepts at all; a
  media transport and a scrubber that would work against any player.
- **`feature/`** — everything that knows what a playlist, a device, a playback
  mode or an auth status is. All of these are still presentational: they take
  props and report events. `Player` is the one exception and the only
  component that reaches for hooks — it wires the two playback modes, the
  playlist and the keyboard controls together.

Shared domain types live in `src/lib/types.ts`, so no component imports from
`src/hooks/`.

## Requirements

- **Spotify Premium.** Both modes need it: the SDK refuses to play without
  it, and so do the Web API's playback controls.
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

  The player detects this by watching those licence requests: a refusal is
  unambiguous, where a stalled position cannot be told apart from ordinary
  buffering. It then says so and offers to switch to remote mode, which needs
  no DRM at all.

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
