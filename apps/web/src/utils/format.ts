const LOCALE = "fr-FR"

/** Format number with French locale (space as thousand separator) */
export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Format as EUR currency string: €4 500 */
export function formatEur(n: number, decimals = 0): string {
  return `€${formatNumber(n, decimals)}`
}
