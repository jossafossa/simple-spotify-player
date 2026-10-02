import { expect, it } from 'vitest'
import { formatFileSize } from './formatFileSize'

it('picks a unit that keeps the number short', () => {
  expect(formatFileSize(900)).toBe('900 B')
  expect(formatFileSize(62_543)).toBe('61 KB')
  expect(formatFileSize(3_400_000)).toBe('3.2 MB')
})
