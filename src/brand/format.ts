// Tiny message formatter — fills {named} placeholders in a template string.
// No i18n library (English-first); a locale file drops in
// beside copy.en.json later and this same formatter renders it. An unknown key is
// left as-is ({key}) so a missing value is visible in dev, never a silent blank.
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}
