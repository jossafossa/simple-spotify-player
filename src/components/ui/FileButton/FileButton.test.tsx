import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { FileButton } from './FileButton'

it('hands over the picked file', async () => {
  const user = userEvent.setup()
  const handleSelect = vi.fn()
  const { getByLabelText } = render(
    <FileButton label="Upload" accept=".gp5" onSelect={handleSelect} />,
  )
  const file = new File(['x'], 'song.gp5')

  await user.upload(getByLabelText('Upload'), file)

  expect(handleSelect).toHaveBeenCalledWith(file)
})
