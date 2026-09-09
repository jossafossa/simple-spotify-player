// Domain-free building blocks: no Spotify concepts, reusable as-is.
export { Card } from './ui/Card'
export { Controls } from './ui/Controls'
export { ProgressBar } from './ui/ProgressBar'

// Feature components: these know what a playlist, a device or a playback mode
// is. Only Player reaches for hooks — the rest take props and report events.
export { ClientIdForm } from './feature/ClientIdForm'
export { DeviceSelect } from './feature/DeviceSelect'
export { ModeToggle } from './feature/ModeToggle'
export { Player } from './feature/Player'
export { PlaylistPanel } from './feature/PlaylistPanel'
export { SpotifyConnect } from './feature/SpotifyConnect'
