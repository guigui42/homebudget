import { HttpApiBuilder } from "@effect/platform"
import { Effect } from "effect"
import { HomeBudgetApi } from "@homebudget/shared"
import * as Repo from "../Db/repos.js"
import { computeSankey } from "../Services/SankeyService.js"
import { fetchLatestEurPhp } from "../Services/EcbService.js"

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export const LocationsLive = HttpApiBuilder.group(
  HomeBudgetApi,
  "locations",
  (handlers) =>
    handlers
      .handle("list", () => Repo.listLocations as any)
      .handle("create", ({ payload }) => Repo.createLocation(payload) as any)
      .handle("update", ({ path, payload }) =>
        Repo.updateLocation(path.id, payload) as any
      )
      .handle("remove", ({ path }) => Repo.removeLocation(path.id).pipe(Effect.orDie))
)

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const CategoriesLive = HttpApiBuilder.group(
  HomeBudgetApi,
  "categories",
  (handlers) =>
    handlers
      .handle("listByLocation", ({ path }) =>
        Repo.listCategoriesByLocation(path.locationId) as any
      )
      .handle("listAll", () => Repo.listAllCategories as any)
      .handle("create", ({ payload }) => Repo.createCategory(payload) as any)
      .handle("update", ({ path, payload }) =>
        Repo.updateCategory(path.id, payload) as any
      )
      .handle("remove", ({ path }) => Repo.removeCategory(path.id).pipe(Effect.orDie))
)

// ---------------------------------------------------------------------------
// Salary
// ---------------------------------------------------------------------------

export const SalaryLive = HttpApiBuilder.group(
  HomeBudgetApi,
  "salary",
  (handlers) =>
    handlers
      .handle("history", () => Repo.salaryHistory as any)
      .handle("current", () =>
        Effect.gen(function* () {
          const entry = yield* Repo.currentSalary
          if (!entry) return yield* Effect.fail(new Error("No salary entry found"))
          return entry
        }) as any
      )
      .handle("create", ({ payload }) => Repo.createSalary(payload) as any)
      .handle("remove", ({ path }) => Repo.removeSalary(path.id).pipe(Effect.orDie))
)

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------

export const PricesLive = HttpApiBuilder.group(
  HomeBudgetApi,
  "prices",
  (handlers) =>
    handlers
      .handle("history", ({ path }) =>
        Repo.priceHistory(path.categoryId) as any
      )
      .handle("create", ({ payload }) => Repo.createPrice(payload) as any)
      .handle("update", ({ path, payload }) =>
        Repo.updatePrice(path.id, payload) as any
      )
      .handle("remove", ({ path }) => Repo.removePrice(path.id).pipe(Effect.orDie))
)

// ---------------------------------------------------------------------------
// Exchange rates
// ---------------------------------------------------------------------------

export const ExchangeRatesLive = HttpApiBuilder.group(
  HomeBudgetApi,
  "exchangeRates",
  (handlers) =>
    handlers
      .handle("history", () => Repo.exchangeRateHistory as any)
      .handle("current", () =>
        Effect.gen(function* () {
          const entry = yield* Repo.currentExchangeRate
          if (!entry) return yield* Effect.fail(new Error("No exchange rate entry found"))
          return entry
        }) as any
      )
      .handle("create", ({ payload }) =>
        Repo.createExchangeRate(payload) as any
      )
      .handle("fetch", () =>
        Effect.gen(function* () {
          const { rate, date } = yield* fetchLatestEurPhp
          return yield* Repo.createExchangeRate({
            fromCurrency: "EUR",
            toCurrency: "PHP",
            rate,
            effectiveFrom: date,
            source: "ecb",
          })
        }) as any
      )
      .handle("remove", ({ path }) => Repo.removeExchangeRate(path.id).pipe(Effect.orDie))
)

// ---------------------------------------------------------------------------
// Sankey
// ---------------------------------------------------------------------------

export const SankeyLive = HttpApiBuilder.group(
  HomeBudgetApi,
  "sankey",
  (handlers) =>
    handlers.handle("getData", ({ urlParams }) => {
      const date =
        urlParams.date || new Date().toISOString().slice(0, 10)
      return computeSankey(date) as any
    })
)

// ---------------------------------------------------------------------------
// Evolution
// ---------------------------------------------------------------------------

export const EvolutionLive = HttpApiBuilder.group(
  HomeBudgetApi,
  "evolution",
  (handlers) =>
    handlers
      .handle("prices", ({ urlParams }) =>
        Effect.gen(function* () {
          const categoryIds = urlParams.categories
            ? urlParams.categories.split(",").map(Number).filter((n) => !isNaN(n))
            : []
          if (categoryIds.length === 0) {
            return { series: [] }
          }
          const rows = yield* Repo.priceEvolution(
            categoryIds,
            urlParams.from,
            urlParams.to
          )
          // Group by category
          const seriesMap = new Map<number, {
            categoryId: number
            categoryName: string
            locationName: string
            currency: string
            points: Array<{ date: string; value: number }>
          }>()
          for (const row of rows as any[]) {
            let series = seriesMap.get(row.expenseCategoryId)
            if (!series) {
              series = {
                categoryId: row.expenseCategoryId,
                categoryName: row.categoryName,
                locationName: row.locationName,
                currency: row.currency,
                points: [],
              }
              seriesMap.set(row.expenseCategoryId, series)
            }
            series.points.push({ date: row.effectiveFrom, value: row.amount })
          }
          return { series: Array.from(seriesMap.values()) }
        }) as any
      )
      .handle("exchangeRate", ({ urlParams }) =>
        Effect.gen(function* () {
          const rows = yield* Repo.exchangeRateEvolution(
            urlParams.from,
            urlParams.to
          )
          const points = (rows as any[]).map((r) => ({
            date: r.effectiveFrom,
            value: r.rate,
          }))
          return {
            fromCurrency: "EUR",
            toCurrency: "PHP",
            points,
          }
        }) as any
      )
      .handle("totalByLocation", ({ urlParams }) =>
        Effect.gen(function* () {
          // Compute total monthly expenses per location for each date that has a price change
          const locations = yield* Repo.listLocations
          const allCategories = yield* Repo.listAllCategories

          // Get all unique dates from price_history
          const sql = yield* Effect.succeed(null) // placeholder
          // For now, return a simplified version
          return {
            baseCurrency: "EUR",
            series: [],
          }
        }) as any
      )
)
