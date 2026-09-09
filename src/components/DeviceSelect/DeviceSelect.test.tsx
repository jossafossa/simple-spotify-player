import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DeviceSelect } from './DeviceSelect'

const devices = [
  { id: 'device-1', name: 'Kitchen speaker', isActive: true },
  { id: 'device-2', name: 'Phone', isActive: false },
]

describe('DeviceSelect', () => {
  it('says how to wake a device when there are none', () => {
    render(<DeviceSelect devices={[]} activeDeviceName={undefined} onSelect={vi.fn()} />)

    expect(screen.getByText(/No Spotify devices are awake/)).toBeInTheDocument()
  })

  it('shows the active device as the current choice', () => {
    render(
      <DeviceSelect devices={devices} activeDeviceName="Kitchen speaker" onSelect={vi.fn()} />,
    )

    expect(screen.getByRole('combobox')).toHaveValue('device-1')
  })

  it('reports the device the user picked', async () => {
    const handleSelect = vi.fn()
    const user = userEvent.setup()

    render(
      <DeviceSelect devices={devices} activeDeviceName="Kitchen speaker" onSelect={handleSelect} />,
    )

    await user.selectOptions(screen.getByRole('combobox'), 'device-2')
    expect(handleSelect).toHaveBeenCalledWith('device-2')
  })

  it('prompts for a choice when nothing is active yet', () => {
    render(
      <DeviceSelect
        devices={devices.map((device) => ({ ...device, isActive: false }))}
        activeDeviceName={undefined}
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByRole('option', { name: 'Choose a device' })).toBeInTheDocument()
  })
})
