// Nimiq user-friendly address validation — "NQ" + 2 check digits + 32 base32 chars, ISO 7064 mod
// 97-10 like an IBAN. Pure and dependency-free so the API can reject garbage before it consumes a
// seed slot or a queue row (AUDIT-CYCLE-II.md §9 C6). @nimiq/core runs the same check when the settle
// service builds the tx; validating here only moves the failure to the request that caused it.
const BODY_RE = /^[0-9A-HJ-NP-VXY]{32}$/

export const normNq = (s: string) => s.replace(/\s+/g, '').toUpperCase()
export const prettyNq = (s: string) => normNq(s).replace(/(.{4})(?=.)/g, '$1 ')

export function isValidNq(s: string): boolean {
  const a = normNq(String(s ?? ''))
  if (a.length !== 36 || !a.startsWith('NQ') || !/^\d{2}$/.test(a.slice(2, 4)) || !BODY_RE.test(a.slice(4))) return false
  return mod97(a.slice(4) + 'NQ' + a.slice(2, 4)) === 1
}

function mod97(s: string): number {
  let rem = 0
  for (const ch of s) {
    const v = ch >= 'A' ? ch.charCodeAt(0) - 55 : Number(ch) // A=10 … Z=35
    for (const d of String(v)) rem = (rem * 10 + Number(d)) % 97
  }
  return rem
}
