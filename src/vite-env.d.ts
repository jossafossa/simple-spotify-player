/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of a separately hosted tab search service; empty means same origin. */
  readonly VITE_TAB_SEARCH_URL?: string
}
