import { Effect } from "effect"
import { SqlClient } from "@effect/sql"
import type { Schemas, Domain } from "@homebudget/shared"

// ---------------------------------------------------------------------------
// Query result types for JOINed queries
// ---------------------------------------------------------------------------

export interface PriceEvolutionRow {
  expenseCategoryId: number
  categoryName: string
  locationName: string
  currency: Domain.Currency
  amount: number
  effectiveFrom: string
}

export interface ExchangeRateEvolutionRow {
  fromCurrency: Domain.Currency
  toCurrency: Domain.Currency
  rate: number
  effectiveFrom: string
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export const listLocations = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  return yield* sql<Schemas.Location>`
    SELECT id, name, country, currency, sort_order, created_at::text
    FROM locations ORDER BY sort_order
  `
})

export const createLocation = (input: Schemas.CreateLocation) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql<Schemas.Location>`
      INSERT INTO locations (name, country, currency, sort_order)
      VALUES (${input.name}, ${input.country}, ${input.currency}, ${input.sortOrder})
      RETURNING id, name, country, currency, sort_order, created_at::text
    `
    return rows[0]!
  })

export const updateLocation = (id: number, input: Schemas.UpdateLocation) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql<Schemas.Location>`
      UPDATE locations SET
        name          = COALESCE(${input.name ?? null}, name),
        country       = COALESCE(${input.country ?? null}, country),
        currency      = COALESCE(${input.currency ?? null}, currency),
        sort_order    = COALESCE(${input.sortOrder ?? null}, sort_order)
      WHERE id = ${id}
      RETURNING id, name, country, currency, sort_order, created_at::text
    `
    return rows[0]!
  })

export const removeLocation = (id: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`DELETE FROM locations WHERE id = ${id}`
  })

// ---------------------------------------------------------------------------
// Expense categories
// ---------------------------------------------------------------------------

export const listCategoriesByLocation = (locationId: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    return yield* sql<Schemas.ExpenseCategory>`
      SELECT id, location_id, parent_id, name, frequency, color, sort_order, created_at::text
      FROM expense_categories
      WHERE location_id = ${locationId}
      ORDER BY sort_order
    `
  })

export const listAllCategories = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  return yield* sql<Schemas.ExpenseCategory>`
    SELECT id, location_id, parent_id, name, frequency, color, sort_order, created_at::text
    FROM expense_categories
    ORDER BY location_id, sort_order
  `
})

export const createCategory = (input: Schemas.CreateExpenseCategory) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql<Schemas.ExpenseCategory>`
      INSERT INTO expense_categories (location_id, parent_id, name, frequency, color, sort_order)
      VALUES (
        ${input.locationId},
        ${input.parentId ?? null},
        ${input.name},
        ${input.frequency},
        ${input.color ?? null},
        ${input.sortOrder}
      )
      RETURNING id, location_id, parent_id, name, frequency, color, sort_order, created_at::text
    `
    return rows[0]!
  })

export const updateCategory = (id: number, input: Schemas.UpdateExpenseCategory) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    // parent_id needs special handling: undefined = don't change, null = set to null
    const updateParent = input.parentId !== undefined
    const rows = yield* sql<Schemas.ExpenseCategory>`
      UPDATE expense_categories SET
        name       = COALESCE(${input.name ?? null}, name),
        frequency  = COALESCE(${input.frequency ?? null}, frequency),
        color      = ${input.color !== undefined ? sql`${input.color ?? null}` : sql`color`},
        sort_order = COALESCE(${input.sortOrder ?? null}, sort_order)
        ${updateParent ? sql`, parent_id = ${input.parentId ?? null}` : sql``}
      WHERE id = ${id}
      RETURNING id, location_id, parent_id, name, frequency, color, sort_order, created_at::text
    `
    return rows[0]!
  })

export const removeCategory = (id: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`DELETE FROM expense_categories WHERE id = ${id}`
  })

export const reorderCategories = (items: ReadonlyArray<{ id: number; sortOrder: number; parentId: number | null }>) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    if (items.length === 0) {
      return yield* sql<Schemas.ExpenseCategory>`
        SELECT id, location_id, parent_id, name, frequency, color, sort_order, created_at::text
        FROM expense_categories ORDER BY location_id, sort_order
      `
    }

    // Validate: if parentId is set, parent must be in the same location_id as the child
    const ids = items.map((i) => i.id)
    const parentIds = items.filter((i) => i.parentId !== null).map((i) => i.parentId!)
    if (parentIds.length > 0) {
      const conflicts = yield* sql`
        SELECT c.id, c.location_id AS child_loc, p.location_id AS parent_loc
        FROM expense_categories c
        JOIN expense_categories p ON p.id = ANY(${parentIds}::int[])
        WHERE c.id = ANY(${ids}::int[])
          AND c.location_id != p.location_id
      `
      if (conflicts.length > 0) {
        return yield* Effect.fail(new Error("Cannot reparent category to a different location"))
      }
    }

    // Single atomic UPDATE via CTE with VALUES list
    const values = items.map((i) => `(${i.id}, ${i.sortOrder}, ${i.parentId === null ? "NULL" : i.parentId})`).join(", ")

    yield* sql.unsafe(`
      UPDATE expense_categories AS ec
      SET sort_order = v.sort_order,
          parent_id  = v.parent_id
      FROM (VALUES ${values}) AS v(id, sort_order, parent_id)
      WHERE ec.id = v.id
    `)

    return yield* sql<Schemas.ExpenseCategory>`
      SELECT id, location_id, parent_id, name, frequency, color, sort_order, created_at::text
      FROM expense_categories
      ORDER BY location_id, sort_order
    `
  })

// ---------------------------------------------------------------------------
// Salary
// ---------------------------------------------------------------------------

export const salaryHistory = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  return yield* sql<Schemas.SalaryEntry>`
    SELECT id, amount::float8, currency, effective_from::text, note, created_at::text
    FROM salary_history
    ORDER BY effective_from DESC
  `
})

export const currentSalary = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  const rows = yield* sql<Schemas.SalaryEntry>`
    SELECT id, amount::float8, currency, effective_from::text, note, created_at::text
    FROM salary_history
    WHERE effective_from <= CURRENT_DATE
    ORDER BY effective_from DESC
    LIMIT 1
  `
  return rows[0]
})

export const salaryAtDate = (date: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql<Schemas.SalaryEntry>`
      SELECT id, amount::float8, currency, effective_from::text, note, created_at::text
      FROM salary_history
      WHERE effective_from <= ${date}::date
      ORDER BY effective_from DESC
      LIMIT 1
    `
    return rows[0]
  })

export const createSalary = (input: Schemas.CreateSalaryEntry) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql<Schemas.SalaryEntry>`
      INSERT INTO salary_history (amount, currency, effective_from, note)
      VALUES (${input.amount}, ${input.currency}, ${input.effectiveFrom}::date, ${input.note ?? null})
      RETURNING id, amount::float8, currency, effective_from::text, note, created_at::text
    `
    return rows[0]!
  })

export const removeSalary = (id: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`DELETE FROM salary_history WHERE id = ${id}`
  })

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------

export const priceHistory = (categoryId: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    return yield* sql<Schemas.PriceEntry>`
      SELECT id, expense_category_id, amount::float8, currency, effective_from::text, note, created_at::text
      FROM price_history
      WHERE expense_category_id = ${categoryId}
      ORDER BY effective_from DESC
    `
  })

export const pricesAtDate = (date: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    return yield* sql<Schemas.PriceEntry>`
      SELECT DISTINCT ON (expense_category_id)
        id, expense_category_id, amount::float8, currency, effective_from::text, note, created_at::text
      FROM price_history
      WHERE effective_from <= ${date}::date
      ORDER BY expense_category_id, effective_from DESC
    `
  })

export const createPrice = (input: Schemas.CreatePriceEntry) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql<Schemas.PriceEntry>`
      INSERT INTO price_history (expense_category_id, amount, currency, effective_from, note)
      VALUES (${input.expenseCategoryId}, ${input.amount}, ${input.currency}, ${input.effectiveFrom}::date, ${input.note ?? null})
      RETURNING id, expense_category_id, amount::float8, currency, effective_from::text, note, created_at::text
    `
    return rows[0]!
  })

export const updatePrice = (id: number, input: Schemas.UpdatePriceEntry) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql<Schemas.PriceEntry>`
      UPDATE price_history SET
        amount         = COALESCE(${input.amount ?? null}, amount),
        effective_from = COALESCE(${input.effectiveFrom ? sql`${input.effectiveFrom}::date` : sql`NULL`}, effective_from),
        note           = ${input.note !== undefined ? sql`${input.note ?? null}` : sql`note`}
      WHERE id = ${id}
      RETURNING id, expense_category_id, amount::float8, currency, effective_from::text, note, created_at::text
    `
    return rows[0]!
  })

export const removePrice = (id: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`DELETE FROM price_history WHERE id = ${id}`
  })

// ---------------------------------------------------------------------------
// Exchange rates
// ---------------------------------------------------------------------------

export const exchangeRateHistory = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  return yield* sql<Schemas.ExchangeRateEntry>`
    SELECT id, from_currency, to_currency, rate::float8, effective_from::text, source, created_at::text
    FROM exchange_rate_history
    ORDER BY effective_from DESC
  `
})

export const currentExchangeRate = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  const rows = yield* sql<Schemas.ExchangeRateEntry>`
    SELECT id, from_currency, to_currency, rate::float8, effective_from::text, source, created_at::text
    FROM exchange_rate_history
    WHERE effective_from <= CURRENT_DATE
    ORDER BY effective_from DESC
    LIMIT 1
  `
  return rows[0]
})

export const exchangeRateAtDate = (date: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql<Schemas.ExchangeRateEntry>`
      SELECT id, from_currency, to_currency, rate::float8, effective_from::text, source, created_at::text
      FROM exchange_rate_history
      WHERE effective_from <= ${date}::date
      ORDER BY effective_from DESC
      LIMIT 1
    `
    return rows[0]
  })

export const createExchangeRate = (input: Schemas.CreateExchangeRateEntry) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql<Schemas.ExchangeRateEntry>`
      INSERT INTO exchange_rate_history (from_currency, to_currency, rate, effective_from, source)
      VALUES (${input.fromCurrency}, ${input.toCurrency}, ${input.rate}, ${input.effectiveFrom}::date, ${input.source})
      RETURNING id, from_currency, to_currency, rate::float8, effective_from::text, source, created_at::text
    `
    return rows[0]!
  })

export const removeExchangeRate = (id: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`DELETE FROM exchange_rate_history WHERE id = ${id}`
  })

// ---------------------------------------------------------------------------
// Price evolution (time series queries)
// ---------------------------------------------------------------------------

export const priceEvolution = (categoryIds: ReadonlyArray<number>, from?: string, to?: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    return yield* sql<PriceEvolutionRow>`
      SELECT
        ph.expense_category_id,
        ec.name AS category_name,
        l.name AS location_name,
        ph.currency,
        ph.amount::float8,
        ph.effective_from::text
      FROM price_history ph
      JOIN expense_categories ec ON ec.id = ph.expense_category_id
      JOIN locations l ON l.id = ec.location_id
      WHERE ph.expense_category_id = ANY(${[...categoryIds]})
      ${from ? sql`AND ph.effective_from >= ${from}::date` : sql``}
      ${to ? sql`AND ph.effective_from <= ${to}::date` : sql``}
      ORDER BY ph.expense_category_id, ph.effective_from
    `
  })

export const exchangeRateEvolution = (from?: string, to?: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    return yield* sql<ExchangeRateEvolutionRow>`
      SELECT from_currency, to_currency, rate::float8, effective_from::text
      FROM exchange_rate_history
      ${from ? sql`WHERE effective_from >= ${from}::date` : sql``}
      ${to ? sql`${from ? sql`AND` : sql`WHERE`} effective_from <= ${to}::date` : sql``}
      ORDER BY effective_from
    `
  })
