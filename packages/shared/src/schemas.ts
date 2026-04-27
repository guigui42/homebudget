import { Schema } from "effect"
import { Currency, Frequency } from "./domain.js"

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export const IdParam = Schema.Struct({ id: Schema.NumberFromString })
export const LocationIdParam = Schema.Struct({ locationId: Schema.NumberFromString })
export const CategoryIdParam = Schema.Struct({ categoryId: Schema.NumberFromString })

// ---------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------

export const Location = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  country: Schema.String,
  currency: Currency,
  sortOrder: Schema.Number,
  createdAt: Schema.String,
})
export type Location = typeof Location.Type

export const CreateLocation = Schema.Struct({
  name: Schema.String,
  country: Schema.String,
  currency: Currency,
  sortOrder: Schema.optionalWith(Schema.Number, { default: () => 0 }),
})
export type CreateLocation = typeof CreateLocation.Type

export const UpdateLocation = Schema.Struct({
  name: Schema.optional(Schema.String),
  country: Schema.optional(Schema.String),
  currency: Schema.optional(Currency),
  sortOrder: Schema.optional(Schema.Number),
})
export type UpdateLocation = typeof UpdateLocation.Type

// ---------------------------------------------------------------------------
// Expense category
// ---------------------------------------------------------------------------

export const ExpenseCategory = Schema.Struct({
  id: Schema.Number,
  locationId: Schema.Number,
  parentId: Schema.NullOr(Schema.Number),
  name: Schema.String,
  frequency: Frequency,
  color: Schema.NullOr(Schema.String),
  sortOrder: Schema.Number,
  createdAt: Schema.String,
})
export type ExpenseCategory = typeof ExpenseCategory.Type

export const CreateExpenseCategory = Schema.Struct({
  locationId: Schema.Number,
  parentId: Schema.NullOr(Schema.Number).pipe(Schema.optional),
  name: Schema.String,
  frequency: Schema.optionalWith(Frequency, { default: () => "monthly" as const }),
  color: Schema.optional(Schema.String),
  sortOrder: Schema.optionalWith(Schema.Number, { default: () => 0 }),
})
export type CreateExpenseCategory = typeof CreateExpenseCategory.Type

export const UpdateExpenseCategory = Schema.Struct({
  parentId: Schema.optional(Schema.NullOr(Schema.Number)),
  name: Schema.optional(Schema.String),
  frequency: Schema.optional(Frequency),
  color: Schema.optional(Schema.NullOr(Schema.String)),
  sortOrder: Schema.optional(Schema.Number),
})
export type UpdateExpenseCategory = typeof UpdateExpenseCategory.Type

// ---------------------------------------------------------------------------
// Salary
// ---------------------------------------------------------------------------

export const SalaryEntry = Schema.Struct({
  id: Schema.Number,
  amount: Schema.Number,
  currency: Currency,
  effectiveFrom: Schema.String, // ISO date YYYY-MM-DD
  note: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
})
export type SalaryEntry = typeof SalaryEntry.Type

export const CreateSalaryEntry = Schema.Struct({
  amount: Schema.Number,
  currency: Schema.optionalWith(Currency, { default: () => "EUR" as const }),
  effectiveFrom: Schema.String,
  note: Schema.optional(Schema.String),
})
export type CreateSalaryEntry = typeof CreateSalaryEntry.Type

// ---------------------------------------------------------------------------
// Price
// ---------------------------------------------------------------------------

export const PriceEntry = Schema.Struct({
  id: Schema.Number,
  expenseCategoryId: Schema.Number,
  amount: Schema.Number,
  currency: Schema.String,
  effectiveFrom: Schema.String,
  note: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
})
export type PriceEntry = typeof PriceEntry.Type

export const CreatePriceEntry = Schema.Struct({
  expenseCategoryId: Schema.Number,
  amount: Schema.Number,
  currency: Schema.String,
  effectiveFrom: Schema.String,
  note: Schema.optional(Schema.String),
})
export type CreatePriceEntry = typeof CreatePriceEntry.Type

export const UpdatePriceEntry = Schema.Struct({
  amount: Schema.optional(Schema.Number),
  effectiveFrom: Schema.optional(Schema.String),
  note: Schema.optional(Schema.NullOr(Schema.String)),
})
export type UpdatePriceEntry = typeof UpdatePriceEntry.Type

// ---------------------------------------------------------------------------
// Exchange rate
// ---------------------------------------------------------------------------

export const ExchangeRateEntry = Schema.Struct({
  id: Schema.Number,
  fromCurrency: Schema.String,
  toCurrency: Schema.String,
  rate: Schema.Number,
  effectiveFrom: Schema.String,
  source: Schema.String,
  createdAt: Schema.String,
})
export type ExchangeRateEntry = typeof ExchangeRateEntry.Type

export const CreateExchangeRateEntry = Schema.Struct({
  fromCurrency: Schema.optionalWith(Schema.String, { default: () => "EUR" }),
  toCurrency: Schema.optionalWith(Schema.String, { default: () => "PHP" }),
  rate: Schema.Number,
  effectiveFrom: Schema.String,
  source: Schema.optionalWith(Schema.String, { default: () => "manual" }),
})
export type CreateExchangeRateEntry = typeof CreateExchangeRateEntry.Type

// ---------------------------------------------------------------------------
// Sankey (computed)
// ---------------------------------------------------------------------------

export const SankeyNode = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  value: Schema.Number,
  color: Schema.optional(Schema.String),
})

export const SankeyLink = Schema.Struct({
  source: Schema.String,
  target: Schema.String,
  value: Schema.Number,
})

export const SankeyData = Schema.Struct({
  nodes: Schema.Array(SankeyNode),
  links: Schema.Array(SankeyLink),
  asOf: Schema.String,
  baseCurrency: Schema.String,
  salaryMonthly: Schema.Number,
  expensesMonthly: Schema.Number,
  savingsMonthly: Schema.Number,
  exchangeRates: Schema.Record({ key: Schema.String, value: Schema.Number }),
})
export type SankeyData = typeof SankeyData.Type

// ---------------------------------------------------------------------------
// Evolution (computed)
// ---------------------------------------------------------------------------

export const TimePoint = Schema.Struct({
  date: Schema.String,
  value: Schema.Number,
})

export const PriceEvolutionSeries = Schema.Struct({
  categoryId: Schema.Number,
  categoryName: Schema.String,
  locationName: Schema.String,
  currency: Schema.String,
  points: Schema.Array(TimePoint),
})

export const PriceEvolutionResponse = Schema.Struct({
  series: Schema.Array(PriceEvolutionSeries),
})
export type PriceEvolutionResponse = typeof PriceEvolutionResponse.Type

export const ExchangeRateEvolutionResponse = Schema.Struct({
  fromCurrency: Schema.String,
  toCurrency: Schema.String,
  points: Schema.Array(TimePoint),
})
export type ExchangeRateEvolutionResponse = typeof ExchangeRateEvolutionResponse.Type

export const LocationTotalSeries = Schema.Struct({
  locationId: Schema.Number,
  locationName: Schema.String,
  points: Schema.Array(TimePoint),
})

export const TotalByLocationResponse = Schema.Struct({
  baseCurrency: Schema.String,
  series: Schema.Array(LocationTotalSeries),
})
export type TotalByLocationResponse = typeof TotalByLocationResponse.Type
