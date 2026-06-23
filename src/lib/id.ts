// crypto.randomUUID() is a secure-context API. Loading a local mini app over
// plain-HTTP LAN (http://<ip>:5173) inside the Nimiq Pay WebView is NOT a secure
// context, so randomUUID can be unavailable on device though it works on desktop
// localhost. Feature-detect and fall back to getRandomValues.
// See nimiq.dev "Load a Local Mini App".
export function safeRandomId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID()
    }
  } catch {
    /* fall through */
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
    .slice(6, 8)
    .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
}

export function isSecureContextAvailable(): boolean {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
}
