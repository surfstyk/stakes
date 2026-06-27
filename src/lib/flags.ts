/**
 * Build-time switch for DEV AFFORDANCES — the `?recon` diagnostics tool and the `?test`
 * fast-clock (2-minute join window). They're for development + testnet only and are
 * compiled OUT of the public/submission build.
 *
 *   npm run build         → DEV_TOOLS = true   (kept; dev + testnet deploys)
 *   npm run build:public  → DEV_TOOLS = false  (stripped; the submission build)
 *
 * When false, `?recon`/`?test` are no-ops, their UI is gone, and — because the check is a
 * compile-time literal — the recon code is tree-shaken out of the bundle.
 */
export const DEV_TOOLS = import.meta.env.VITE_PUBLIC_BUILD !== '1'
