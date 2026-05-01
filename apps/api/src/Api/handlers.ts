import { HttpApiBuilder } from "@effect/platform"
import { Effect } from "effect"
import { HomeBudgetApi, Schemas, Domain } from "@homebudget/shared"
import * as Repo from "../Db/repos.js"
import { computeSankey } from "../Services/SankeyService.js"
import { fetchLatestEurPhp } from "../Services/EcbService.js"

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

const orDieLog = <A, E>(effect: Effect.Effect<A, E>) =>
  effect.pipe(Effect.tapErrorCause(Effect.logError), Effect.orDie)

export const LocationsLive = HttpApiBuilder.group(
  HomeBudgetApi,
  "locations",
  (handlers) =>
    handlers
      .handle("list", () => orDieLog(Repo.listLocations))
      .handle("create", ({ payload }) => orDieLog(Repo.createLocation(payload)))
      .handle("update", ({ path, payload }) =>
        orDieLog(Repo.updateLocation(path.id, payload))
      )
      .handle("remove", ({ path }) => orDieLog(Repo.removeLocation(path.id)))
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
        orDieLog(Repo.listCategoriesByLocation(path.locationId))
      )
      .handle("listAll", () => orDieLog(Repo.listAllCategories))
      .handle("create", ({ payload }) => orDieLog(Repo.createCategory(payload)))
      .handle("update", ({ path, payload }) =>
        orDieLog(Repo.updateCategory(path.id, payload))
      )
      .handle("remove", ({ path }) => orDieLog(Repo.removeCategory(path.id)))
      .handle("reorder", ({ payload }) =>
        orDieLog(Repo.reorderCategories(payload.items))
      )
)

// ---------------------------------------------------------------------------
// Salary
// ---------------------------------------------------------------------------

export const SalaryLive = HttpApiBuilder.group(
  HomeBudgetApi,
  "salary",
  (handlers) =>
    handlers
      .handle("history", () => orDieLog(Repo.salaryHistory))
      .handle("current", () =>
        orDieLog(Repo.currentSalary).pipe(
          Effect.flatMap((entry) =>
            entry
              ? Effect.succeed(entry)
              : Effect.fail(new Schemas.NotFoundError({ message: "No salary entry found" }))
          )
        )
      )
      .handle("create", ({ payload }) => orDieLog(Repo.createSalary(payload)))
      .handle("remove", ({ path }) => orDieLog(Repo.removeSalary(path.id)))
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
        orDieLog(Repo.priceHistory(path.categoryId))
      )
      .handle("create", ({ payload }) => orDieLog(Repo.createPrice(payload)))
      .handle("update", ({ path, payload }) =>
        orDieLog(Repo.updatePrice(path.id, payload))
      )
      .handle("remove", ({ path }) => orDieLog(Repo.removePrice(path.id)))
)

// ---------------------------------------------------------------------------
// Exchange rates
// ---------------------------------------------------------------------------

export const ExchangeRatesLive = HttpApiBuilder.group(
  HomeBudgetApi,
  "exchangeRates",
  (handlers) =>
    handlers
      .handle("history", () => orDieLog(Repo.exchangeRateHistory))
      .handle("current", () =>
        orDieLog(Repo.currentExchangeRate).pipe(
          Effect.flatMap((entry) =>
            entry
              ? Effect.succeed(entry)
              : Effect.fail(new Schemas.NotFoundError({ message: "No exchange rate entry found" }))
          )
        )
      )
      .handle("create", ({ payload }) =>
        orDieLog(Repo.createExchangeRate(payload))
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
        }).pipe(Effect.tapErrorCause(Effect.logError), Effect.orDie)
      )
      .handle("remove", ({ path }) => orDieLog(Repo.removeExchangeRate(path.id)))
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
      return computeSankey(date).pipe(Effect.tapErrorCause(Effect.logError), Effect.orDie)
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
            currency: Domain.Currency
            points: Array<{ date: string; value: number }>
          }>()
          for (const row of rows) {
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
        }).pipe(Effect.tapErrorCause(Effect.logError), Effect.orDie)
      )
      .handle("exchangeRate", ({ urlParams }) =>
        Effect.gen(function* () {
          const rows = yield* Repo.exchangeRateEvolution(
            urlParams.from,
            urlParams.to
          )
          const points = rows.map((r) => ({
            date: r.effectiveFrom,
            value: r.rate,
          }))
          return {
            fromCurrency: "EUR" as const,
            toCurrency: "PHP" as const,
            points,
          }
        }).pipe(Effect.tapErrorCause(Effect.logError), Effect.orDie)
      )
      .handle("totalByLocation", ({ urlParams }) =>
        Effect.gen(function* () {
          const locations = yield* Repo.listLocations
          const categories = yield* Repo.listAllCategories

          if (categories.length === 0 || locations.length === 0) {
            return { baseCurrency: "EUR", series: [] }
          }

          const allCatIds = categories.map((c) => c.id)
          const priceRows = yield* Repo.priceEvolution(allCatIds, urlParams.from, urlParams.to)
          const fxRows = yield* Repo.exchangeRateEvolution(urlParams.from, urlParams.to)

          // Collect all unique dates from price changes
          const uniqueDates = [...new Set(priceRows.map((r) => r.effectiveFrom))].sort()
          if (uniqueDates.length === 0) {
            return { baseCurrency: "EUR", series: [] }
          }

          // Build price lookup: sorted prices per category
          const pricesByCategory = new Map<number, Array<{ date: string; amount: number; currency: string }>>()
          for (const row of priceRows) {
            let arr = pricesByCategory.get(row.expenseCategoryId)
            if (!arr) {
              arr = []
              pricesByCategory.set(row.expenseCategoryId, arr)
            }
            arr.push({ date: row.effectiveFrom, amount: row.amount, currency: row.currency })
          }

          // Sort exchange rates chronologically for lookup
          const fxSorted = [...fxRows].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
          const getPhpToEurAt = (date: string): number => {
            let rate = 0
            for (const fx of fxSorted) {
              if (fx.effectiveFrom <= date) rate = 1 / fx.rate
              else break
            }
            return rate
          }

          // Category lookup
          const catById = new Map(categories.map((c) => [c.id, c]))

          // Initialize series per location
          const seriesMap = new Map<number, Array<{ date: string; value: number }>>()
          for (const loc of locations) {
            seriesMap.set(loc.id, [])
          }

          for (const date of uniqueDates) {
            const phpToEur = getPhpToEurAt(date)
            const locTotals = new Map<number, number>()

            for (const [catId, prices] of pricesByCategory) {
              // Find latest price at or before this date (prices are chronological)
              let latestPrice: { amount: number; currency: string } | null = null
              for (const p of prices) {
                if (p.date > date) break
                latestPrice = p
              }
              if (!latestPrice) continue

              const cat = catById.get(catId)
              if (!cat) continue

              let monthlyEur = Domain.toMonthly(latestPrice.amount, cat.frequency)
              if (latestPrice.currency === "PHP") monthlyEur *= phpToEur

              const prev = locTotals.get(cat.locationId) ?? 0
              locTotals.set(cat.locationId, prev + monthlyEur)
            }

            for (const [locId, total] of locTotals) {
              seriesMap.get(locId)?.push({
                date,
                value: Math.round(total * 100) / 100,
              })
            }
          }

          return {
            baseCurrency: "EUR",
            series: locations
              .map((loc) => ({
                locationId: loc.id,
                locationName: loc.name,
                points: seriesMap.get(loc.id) ?? [],
              }))
              .filter((s) => s.points.length > 0),
          }
        }).pipe(Effect.tapErrorCause(Effect.logError), Effect.orDie)
      )
)
