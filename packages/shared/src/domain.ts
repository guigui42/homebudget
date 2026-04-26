import { Schema } from "effect"

// ---------------------------------------------------------------------------
// Currencies & frequencies
// ---------------------------------------------------------------------------

export const Currency = Schema.Literal("EUR", "PHP")
export type Currency = typeof Currency.Type

export const Frequency = Schema.Literal("weekly", "monthly", "quarterly", "yearly")
export type Frequency = typeof Frequency.Type

/** Convert a per-frequency amount to its monthly equivalent. */
export const toMonthly = (amount: number, frequency: Frequency): number => {
  switch (frequency) {
    case "weekly":
      return amount * (52 / 12)
    case "monthly":
      return amount
    case "quarterly":
      return amount / 3
    case "yearly":
      return amount / 12
  }
}
