/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Stakes treasury (custody) NIM address. Stakes are sent here on join. */
  readonly VITE_TREASURY_NIM_ADDRESS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
