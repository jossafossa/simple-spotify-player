import type { TabFormat } from './types'

const FORMATS_BY_EXTENSION: Record<string, TabFormat> = {
  gp3: 'guitar-pro',
  gp4: 'guitar-pro',
  gp5: 'guitar-pro',
  gpx: 'guitar-pro',
  gp: 'guitar-pro',
  ptb: 'power-tab',
}

/** For the file picker's `accept` attribute. */
export const TAB_FILE_ACCEPT = Object.keys(FORMATS_BY_EXTENSION)
  .map((extension) => `.${extension}`)
  .join(',')

const extensionOf = (fileName: string): string => {
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex === -1 ? '' : fileName.slice(dotIndex + 1).toLowerCase()
}

export const detectTabFormat = (fileName: string): TabFormat | undefined =>
  FORMATS_BY_EXTENSION[extensionOf(fileName)]

export const stripExtension = (fileName: string): string => {
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
}

/**
 * alphaTab reads every Guitar Pro version; nothing in the browser reads Power
 * Tab, so those files are kept and exported but cannot be drawn.
 */
export const isRenderableFormat = (format: TabFormat): boolean => format === 'guitar-pro'
