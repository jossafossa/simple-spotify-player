import type { RemoteDevice } from '~/hooks/useRemotePlayer'
import styles from './DeviceSelect.module.scss'

type DeviceSelectProps = {
  devices: RemoteDevice[]
  activeDeviceName: string | undefined
  onSelect: (deviceId: string) => void
}

export const DeviceSelect = ({ devices, activeDeviceName, onSelect }: DeviceSelectProps) => {
  if (devices.length === 0) {
    return (
      <p className={styles.empty}>
        No Spotify devices are awake. Open Spotify on a phone, desktop or
        speaker and it will appear here.
      </p>
    )
  }

  const activeDevice = devices.find((device) => device.isActive)

  return (
    <label className={styles.wrapper}>
      <span className={styles.label}>Playing on</span>
      <select
        className={styles.select}
        value={activeDevice?.id ?? ''}
        onChange={(event) => onSelect(event.target.value)}
      >
        {!activeDevice && (
          <option value="" disabled>
            {activeDeviceName ?? 'Choose a device'}
          </option>
        )}
        {devices.map((device) => (
          <option key={device.id} value={device.id}>
            {device.name}
          </option>
        ))}
      </select>
    </label>
  )
}
