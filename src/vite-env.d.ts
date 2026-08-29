/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Stakes treasury (custody) NIM address. Stakes are sent here on join. */
  readonly VITE_TREASURY_NIM_ADDRESS?: string
  /** The published stamp address — every check-in's dust+data tx goes here (src/vault/stamp.ts). */
  readonly VITE_STAMP_ADDRESS?: string
  /** Dust value per stamp in luna (default 1). */
  readonly VITE_STAMP_VALUE_LUNA?: string
  /** Set to '1' for the locked-down public/submission build → strips ?recon + ?test. */
  readonly VITE_PUBLIC_BUILD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
