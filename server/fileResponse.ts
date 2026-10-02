export const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024

/** The file name a site sends, when it looks like a tab file's; the fallback otherwise. */
export const fileNameFrom = (disposition: string | null, fallback: string): string => {
  const name = /filename="?([^";]+)"?/i.exec(disposition ?? '')?.[1]?.trim()
  return name && /^[\w .,()'&-]+\.(gp[345x]?|ptb)$/i.test(name) ? name : fallback
}

/** The body of a file download, refused when it is empty, too big or a page instead. */
export const readFileResponse = async (response: Response, site: string): Promise<Uint8Array> => {
  const data = new Uint8Array(await response.arrayBuffer())
  const isPage = response.headers.get('content-type')?.includes('text/html') ?? false

  if (!response.ok || isPage || data.byteLength === 0 || data.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new Error(`${site} did not hand over the file (${response.status}).`)
  }

  return data
}
