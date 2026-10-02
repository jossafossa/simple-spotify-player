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

- **`ui/`** — `AppBar`, `Card`, `Controls`, `ProgressBar`, `VolumeControl`, `Modal`,
  `FileButton`. No Spotify concepts at all; a media transport, a scrubber and
  a few generic building blocks that would work in any app.
- **`feature/`** — everything that knows what a playlist, a device, a playback
  mode or an auth status is. All of these are still presentational: they take
  props and report events. `Player` is the exception that reaches for hooks —
  it wires the two playback modes, the playlist, the tabs and the keyboard
  controls together. `TabViewer` is the other one: alphaTab is an imperative
  widget that has to own its DOM node.

Shared domain types live in `src/lib/types.ts`, so no component imports from
`src/hooks/`.

## Volume, browsing and pins

- **Volume** — a slider under the transport, plus a mute button. In remote
  mode it drives the device's own volume and hides itself for devices that
  cannot change it; slider drags are sent once they settle, not per pixel.
  Muting is a volume of zero, so other Spotify clients see it too; unmuting
  restores the level from before.
- **Browse** — the picker above the track list opens any of your playlists.
  Clicking a track starts it inside that playlist, so the rest of it queues
  up behind. *Now playing* goes back to following playback. The picker is
  there before anything plays as well, so a session can start from it.
- **Shuffle** — the switch left of the transport, lit in ochre while on.
  It follows changes made from other Spotify clients as well.
- **Pins** — the star pins the open playlist. Pinned names sit above the
  picker as one-click shortcuts and are remembered per browser.

## Guitar tabs

Tabs are linked to songs and stored in the browser — no server involved.

- **Adding** — the **TAB** button beside any track (or *Add tab* under the
  now-playing card) opens that song's tabs. Search the library and **Add** a
  tab you already have, or upload a new file; it is stored and linked at once.
  A track with tabs keeps its TAB button lit, and clicking it opens the tab.
- **Viewing** — the tab opens as a full-page view, drawn as notation and
  tablature by [alphaTab](https://alphatab.net/). All controls sit in a bar
  along the bottom: *Play tab* plays it through alphaTab's own synthesizer
  (with a following cursor), separately from Spotify; pick another instrument
  track or another tab on the song; and Spotify's own play/previous/next to
  play along. *← Back to player* (or Escape) returns.
- **Preview** — every free online result, and every library tab not yet on
  the song, has *Preview*: it opens full page without storing or linking
  anything. *Add to this song* in its top bar adds it (an online file is
  stored from the copy already downloaded); *← Back* returns to the search.
- **Follows the song** — when the next song starts, an open tab view moves
  along: to that song's tab if it has one, back to the player if it does not.
  A tab opened for another song stays until the song changes; a preview stays
  open regardless.
- **Sync with Spotify** — optional, off by default: tick *Sync with
  Spotify* in the tab view's bottom bar and the cursor follows the song
  playing in Spotify instead of the tab's own player, scrolling along and
  jumping when you seek. A transcription seldom lines up exactly with the
  recording, so − / + nudge the tab half a second at a time (click the value
  to reset); the offset is remembered per tab. A tempo that drifts apart
  within the song cannot be corrected this way.
- **Finding tabs** — the add-tab dialog searches tab sites for the song
  when you press *Search* (artist and title prefilled, with Spotify's
  "- Remastered 2021" and "(feat. …)" stripped). **Free to download** results — from
  [GProTab](https://gprotab.net), which shares Guitar Pro files with no
  account — are added with one click: downloaded, stored and linked to the
  song. Songsterr and Ultimate Guitar results are listed too, with ratings
  and votes, but their files need an account there, so they open on their
  site: download there, then upload.
- **Library** — *Tab library* lists every song with tabs (open a tab, play the
  song on its own, manage its tabs) and every file (open, delete), all
  searchable by song, artist or tab name.
- **Formats** — Guitar Pro `.gp3`, `.gp4`, `.gp5`, `.gpx` and `.gp` are drawn
  and played. Power Tab `.ptb` files are accepted and kept with the song, but
  nothing in the browser can read them: the viewer offers the file back for
  conversion — open it in [TuxGuitar](https://www.tuxguitar.app/), save as
  `.gp5`, upload that.
- **Import / export** — the library's *Backup* section exports everything
  this app stores (tab files, song links, pinned playlists) as one JSON file,
  and imports one back. Importing adds to what is there rather than replacing
  it. Since all of it lives in this browser's IndexedDB, clearing site data
  deletes it — export to keep a copy, or to move it to another browser.

alphaTab (~1.1 MB) is only downloaded when a tab is first opened. Its Vite
plugin copies the notation font and sound font into `public/` on every dev
start and build, which is why those folders are git-ignored.

### Keyboard

| Key       | Action           |
| --------- | ---------------- |
| Space     | Play / pause     |
| ← / →     | Seek 5 s         |
| ↑ / ↓     | Volume ±5        |
| M         | Mute / unmute    |
| S         | Shuffle on / off |
| N / P     | Next / previous  |

## Running

```bash
pnpm dev               # develop: app and tab search, with hot reload
docker compose up -d   # host: the production build, app and search together
```

`pnpm dev` serves on <http://127.0.0.1:5173> — Spotify only accepts the
loopback IP, not `localhost`, as a plain-http redirect URI.

### Hosting

The root `Dockerfile` builds the app and runs `server/main.ts`, which serves
both the built site and the tab search on **port 3000**. `docker compose up
-d` builds and starts it; `APP_PORT=8080 docker compose up -d` publishes it on
another port.

On **Coolify**: add the repository and choose the *Dockerfile* (or *Docker
Compose*) build pack, keeping the defaults — Coolify gives the app a domain
with HTTPS on port 3000. Then, in your Spotify app's settings, add
`https://<that domain>/` as a Redirect URI. That is the only manual step:
the Client ID is entered in the app itself.

Anywhere else, put HTTPS in front of port 3000 — Spotify refuses plain-http
redirect URIs other than `127.0.0.1`.

For developing inside containers instead, `docker compose -f
docker-compose.dev.yml up` runs the Vite dev server and the search service
with hot reload.

### Tab search service

`server/` is the one piece with a server: browsers may not call tab sites
directly, so it searches them on the app's behalf. It is plain Node 22
TypeScript with no dependencies, run as-is by Node's type stripping.

- `GET /api/tabs/search?artist=&title=` asks GProTab, Songsterr and
  Ultimate Guitar in parallel, ranks the results (title match, then artist,
  downloadable first, then votes), and reports any source that failed
  without failing the search. Pages are cached for ten minutes.
- `GET /api/tabs/download?path=/en/tabs/<artist>/<song>` fetches a GProTab
  file. The path must have exactly that shape, so the route cannot be used
  to fetch anything else.

Under `pnpm dev` and `pnpm preview` Vite mounts it as middleware; in the
Docker image the same server also serves the built app (`STATIC_DIR`).
`pnpm tab-search` runs the search alone on port 8787.

To host the search apart from the app, run the same image (or `node
server/main.ts`) there and build the app with
`VITE_TAB_SEARCH_URL=https://<search domain> pnpm build`. Set
`ALLOWED_ORIGINS` on the search to the app's origin (comma-separated, `*`
for any) so browsers let the app read its answers.

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
from — or of the playlist picked in the browser — and clicking one jumps to it. Two things it cannot show, both by
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
