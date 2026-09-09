/** Every Spotify stream fetches a DRM licence from a path containing this. */
const LICENSE_PATH = '/widevine-license/'

type LicenseListener = (isGranted: boolean) => void

const listeners = new Set<LicenseListener>()
let isInstalled = false

const isLicenseUrl = (url: string): boolean => url.includes(LICENSE_PATH)

const urlOf = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') {
    return input
  }

  return input instanceof URL ? input.href : input.url
}

const report = (isGranted: boolean): void => {
  for (const listener of listeners) {
    listener(isGranted)
  }
}

/**
 * Installs the interception once, and never removes it.
 *
 * Swapping the globals per subscriber would mean restoring them by assigning
 * the captured originals back, which clobbers any patch installed in the
 * meantime and double-wraps under React's development double-invoke. One
 * permanent, idempotent install avoids the whole ordering problem.
 */
const install = (): void => {
  if (isInstalled) {
    return
  }

  isInstalled = true

  const originalOpen = XMLHttpRequest.prototype.open
  const originalFetch = window.fetch

  XMLHttpRequest.prototype.open = function patchedOpen(
    this: XMLHttpRequest,
    ...args: Parameters<typeof originalOpen>
  ) {
    const [, url] = args

    if (typeof url === 'string' && isLicenseUrl(url)) {
      this.addEventListener('loadend', () => report(this.status < 400))
    }

    return originalOpen.apply(this, args)
  } as typeof originalOpen

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await originalFetch(input, init)

    if (isLicenseUrl(urlOf(input))) {
      report(response.ok)
    }

    return response
  }
}

/**
 * Watches whether Spotify grants this browser a DRM licence.
 *
 * A browser whose Widevine build has no licence — Firefox forks ship the
 * plugin unlicensed — answers 403 here, and playback then stops a few seconds
 * in with the SDK reporting nothing at all. Position polling cannot tell that
 * apart from ordinary buffering, but the licence request itself is
 * unambiguous, so it is observed rather than the symptom being guessed at.
 *
 * Returns an unsubscribe function.
 */
export const watchWidevineLicense = (listener: LicenseListener): (() => void) => {
  install()
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}
