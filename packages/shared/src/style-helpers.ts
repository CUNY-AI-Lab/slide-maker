/**
 * Build an inline style attribute string for fontSize (and optional extra styles).
 * Used by html-renderer.ts and slide-html.ts to avoid duplicating the same pattern.
 */
export function buildFontSizeAttr(
  fontSize: unknown,
  esc: (s: string) => string,
  extraStyles?: string[],
): string {
  const styles = extraStyles ? [...extraStyles] : []
  if (fontSize && typeof fontSize === 'string') {
    styles.push(`font-size: ${esc(fontSize)}`)
  }
  return styles.length ? ` style="${styles.join('; ')}"` : ''
}
