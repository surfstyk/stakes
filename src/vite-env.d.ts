/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Stakes treasury (custody) NIM address. Stakes are sent here on join. */
  readonly VITE_TREASURY_NIM_ADDRESS?: string
  /** Set to '1' for the locked-down public/submission build → strips ?recon + ?test. */
  readonly VITE_PUBLIC_BUILD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
