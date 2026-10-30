/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the API + Socket.IO server. Empty in local dev (uses the proxy). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
