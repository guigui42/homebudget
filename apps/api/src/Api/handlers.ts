import { HttpApiBuilder } from "@effect/platform"
import { Effect } from "effect"
import { HomeBudgetApi, Schemas, Domain } from "@homebudget/shared"
import * as Repo from "../Db/repos.js"
import { SankeyService } from "../Services/SankeyService.js"
import { EcbService } from "../Services/EcbService.js"
import { logAndDie, logAndDieUnlessNotFound } from "./errorHandling.js"

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export const LocationsLive = HttpApiBuilder.group(
  HomeBudgetApi,
  "locations",
  (handlers) =>
    handlers
      .handle("list", () => logAndDie(Repo.listLocations, "list locations"))
      .handle("create", ({ payload }) =>
        logAndDie(Repo.createLocation(payload), "create location")
      )
      .handle("update", ({ path, payload }) =>
        logAndDieUnlessNotFound(Repo.updateLocation(path.id, payload), "update location")
      )
      .handle("remove", ({ path }) =>
        logAndDie(Repo.removeLocation(path.id), "remove location")
      )
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
        logAndDie(Repo.listCategoriesByLocation(path.locationId), "list categories by location")
      )
      .handle("listAll", () =>
        logAndDie(Repo.listAllCategories, "list all categories")
      )
      .handle("create", ({ payload }) =>
        logAndDie(Repo.createCategory(payload), "create category")
      )
      .handle("update", ({ path, payload }) =>
        logAndDieUnlessNotFound(Repo.updateCategory(path.id, payload), "update category")
      )
      .handle("remove", ({ path }) =>
        logAndDie(Repo.removeCategory(path.id), "remove category")
      )
      .handle("reorder", ({ payload }) =>
        Repo.reorderCategories(payload.items).pipe(
          Effect.tapError((e) => Effect.logError({ message: "reorder categories", error: e })),
          Effect.catchAll((error) =>
            error instanceof Schemas.ValidationError
              ? Effect.fail(error)
              : Effect.die(error)
          )
        )
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
      .handle("history", () =>
        logAndDie(Repo.salaryHistory, "list salary history")
      )
      .handle("current", () =>
        Repo.currentSalary.pipe(
          Effect.tapError((e) => Effect.logError({ message: "fetch current salary", error: e })),
          Effect.orDie,
          Effect.flatMap((entry) =>
            entry
              ? Effect.succeed(entry)
              : Effect.fail(new Schemas.NotFoundError({ message: "No salary entry found" }))
          )
        )
      )
      .handle("create", ({ payload }) =>
        logAndDie(Repo.createSalary(payload), "create salary")
      )
      .handle("remove", ({ path }) =>
        logAndDie(Repo.removeSalary(path.id), "remove salary")
      )
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
        logAndDie(Repo.priceHistory(path.categoryId), "list price history")
      )
      .handle("create", ({ payload }) =>
        logAndDie(Repo.createPrice(payload), "create price")
      )
      .handle("update", ({ path, payload }) =>
        logAndDieUnlessNotFound(Repo.updatePrice(path.id, payload), "update price")
      )
      .handle("remove", ({ path }) =>
        logAndDie(Repo.removePrice(path.id), "remove price")
      )
)

// ---------------------------------------------------------------------------
// Exchange rates
// ---------------------------------------------------------------------------

export const ExchangeRatesLive = HttpApiBuilder.group(
  HomeBudgetApi,
  "exchangeRates",
  (handlers) =>
    handlers
      .handle("history", () =>
        logAndDie(Repo.exchangeRateHistory, "list exchange rate history")
      )
      .handle("current", () =>
        Repo.currentExchangeRate.pipe(
          Effect.tapError((e) =>
            Effect.logError({ message: "fetch current exchange rate", error: e })
          ),
          Effect.orDie,
          Effect.flatMap((entry) =>
            entry
              ? Effect.succeed(entry)
              : Effect.fail(new Schemas.NotFoundError({ message: "No exchange rate entry found" }))
          )
        )
      )
      .handle("create", ({ payload }) =>
        logAndDie(Repo.createExchangeRate(payload), "create exchange rate")
      )
      .handle("fetch", () =>
        Effect.gen(function* () {
          const { fetchLatestEurPhp } = yield* EcbService
          const { rate, date } = yield* fetchLatestEurPhp
          return yield* Repo.createExchangeRate({
            fromCurrency: "EUR",
            toCurrency: "PHP",
            rate,
            effectiveFrom: date,
            source: "ecb",
          })
        }).pipe(
          Effect.tapErrorCause(Effect.logError),
          Effect.catchAll((error) => {
            const tag = (error as { _tag?: string })?._tag
            if (
              tag === "EcbFetchError" ||
              tag === "EcbParseError" ||
              tag === "EcbMissingRateError"
            ) {
              return Effect.fail(
                new Schemas.ExternalServiceError({ message: (error as { message: string }).message })
              )
            }
            return Effect.die(error)
          }),
        )
      )
      .handle("remove", ({ path }) =>
        logAndDie(Repo.removeExchangeRate(path.id), "remove exchange rate")
      )
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
      return Effect.gen(function* () {
        const sankeyService = yield* SankeyService
        return yield* sankeyService.computeSankey(date)
      }).pipe(
        Effect.tapErrorCause(Effect.logError),
        Effect.orDie,
      )
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
        }).pipe(
          Effect.tapErrorCause(Effect.logError),
          Effect.orDie,
        )
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
        }).pipe(
          Effect.tapErrorCause(Effect.logError),
          Effect.orDie,
        )
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

          const uniqueDates = [...new Set(priceRows.map((r) => r.effectiveFrom))].sort()
          if (uniqueDates.length === 0) {
            return { baseCurrency: "EUR", series: [] }
          }

          const pricesByCategory = new Map<number, Array<{ date: string; amount: number; currency: string }>>()
          for (const row of priceRows) {
            let arr = pricesByCategory.get(row.expenseCategoryId)
            if (!arr) {
              arr = []
              pricesByCategory.set(row.expenseCategoryId, arr)
            }
            arr.push({ date: row.effectiveFrom, amount: row.amount, currency: row.currency })
          }

          const fxSorted = [...fxRows].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
          const getPhpToEurAt = (date: string): number => {
            let rate = 0
            for (const fx of fxSorted) {
              if (fx.effectiveFrom <= date) rate = 1 / fx.rate
              else break
            }
            return rate
          }

          const catById = new Map(categories.map((c) => [c.id, c]))

          const seriesMap = new Map<number, Array<{ date: string; value: number }>>()
          for (const loc of locations) {
            seriesMap.set(loc.id, [])
          }

          for (const date of uniqueDates) {
            const phpToEur = getPhpToEurAt(date)
            const locTotals = new Map<number, number>()

            for (const [catId, prices] of pricesByCategory) {
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
        }).pipe(
          Effect.tapErrorCause(Effect.logError),
          Effect.orDie,
        )
      )
)
