// Domain-free building blocks: no Spotify concepts, reusable as-is.
export { Card } from './ui/Card'
export { Controls } from './ui/Controls'
export { ProgressBar } from './ui/ProgressBar'
export { FileButton } from './ui/FileButton'
export { Modal } from './ui/Modal'
export { VolumeControl } from './ui/VolumeControl'

// Feature components: these know what a playlist, a device or a playback mode
// is. Only Player and TabViewer reach for hooks — the rest take props and
// report events.
export { ClientIdForm } from './feature/ClientIdForm'
export { DeviceSelect } from './feature/DeviceSelect'
export { ModeToggle } from './feature/ModeToggle'
export { OnlineTabSearch } from './feature/OnlineTabSearch'
export { Player } from './feature/Player'
export { PlaylistBrowser } from './feature/PlaylistBrowser'
export { PlaylistPanel } from './feature/PlaylistPanel'
export { SpotifyConnect } from './feature/SpotifyConnect'
export { TabLibrary } from './feature/TabLibrary'
export { TabPicker } from './feature/TabPicker'
export { TabViewer } from './feature/TabViewer'
export { TabDialogs, TabViewerSlot } from './feature/TabWorkspace'
