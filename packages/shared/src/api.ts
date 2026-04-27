import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Schema } from "effect"
import * as S from "./schemas.js"

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

const LocationsApi = HttpApiGroup.make("locations")
  .add(
    HttpApiEndpoint.get("list", "/api/locations")
      .addSuccess(Schema.Array(S.Location))
  )
  .add(
    HttpApiEndpoint.post("create", "/api/locations")
      .setPayload(S.CreateLocation)
      .addSuccess(S.Location)
  )
  .add(
    HttpApiEndpoint.patch("update", "/api/locations/:id")
      .setPath(S.IdParam)
      .setPayload(S.UpdateLocation)
      .addSuccess(S.Location)
  )
  .add(
    HttpApiEndpoint.del("remove", "/api/locations/:id")
      .setPath(S.IdParam)
  )

// ---------------------------------------------------------------------------
// Expense categories
// ---------------------------------------------------------------------------

const CategoriesApi = HttpApiGroup.make("categories")
  .add(
    HttpApiEndpoint.get("listByLocation", "/api/locations/:locationId/categories")
      .setPath(S.LocationIdParam)
      .addSuccess(Schema.Array(S.ExpenseCategory))
  )
  .add(
    HttpApiEndpoint.get("listAll", "/api/categories")
      .addSuccess(Schema.Array(S.ExpenseCategory))
  )
  .add(
    HttpApiEndpoint.post("create", "/api/categories")
      .setPayload(S.CreateExpenseCategory)
      .addSuccess(S.ExpenseCategory)
  )
  .add(
    HttpApiEndpoint.patch("update", "/api/categories/:id")
      .setPath(S.IdParam)
      .setPayload(S.UpdateExpenseCategory)
      .addSuccess(S.ExpenseCategory)
  )
  .add(
    HttpApiEndpoint.del("remove", "/api/categories/:id")
      .setPath(S.IdParam)
  )

// ---------------------------------------------------------------------------
// Salary
// ---------------------------------------------------------------------------

const SalaryApi = HttpApiGroup.make("salary")
  .add(
    HttpApiEndpoint.get("history", "/api/salary/history")
      .addSuccess(Schema.Array(S.SalaryEntry))
  )
  .add(
    HttpApiEndpoint.get("current", "/api/salary/current")
      .addSuccess(S.SalaryEntry)
      .addError(S.NotFoundError, { status: 404 })
  )
  .add(
    HttpApiEndpoint.post("create", "/api/salary")
      .setPayload(S.CreateSalaryEntry)
      .addSuccess(S.SalaryEntry)
  )
  .add(
    HttpApiEndpoint.del("remove", "/api/salary/:id")
      .setPath(S.IdParam)
  )

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------

const PricesApi = HttpApiGroup.make("prices")
  .add(
    HttpApiEndpoint.get("history", "/api/prices/:categoryId/history")
      .setPath(S.CategoryIdParam)
      .addSuccess(Schema.Array(S.PriceEntry))
  )
  .add(
    HttpApiEndpoint.post("create", "/api/prices")
      .setPayload(S.CreatePriceEntry)
      .addSuccess(S.PriceEntry)
  )
  .add(
    HttpApiEndpoint.patch("update", "/api/prices/:id")
      .setPath(S.IdParam)
      .setPayload(S.UpdatePriceEntry)
      .addSuccess(S.PriceEntry)
  )
  .add(
    HttpApiEndpoint.del("remove", "/api/prices/:id")
      .setPath(S.IdParam)
  )

// ---------------------------------------------------------------------------
// Exchange rates
// ---------------------------------------------------------------------------

const ExchangeRatesApi = HttpApiGroup.make("exchangeRates")
  .add(
    HttpApiEndpoint.get("history", "/api/exchange-rates/history")
      .addSuccess(Schema.Array(S.ExchangeRateEntry))
  )
  .add(
    HttpApiEndpoint.get("current", "/api/exchange-rates/current")
      .addSuccess(S.ExchangeRateEntry)
      .addError(S.NotFoundError, { status: 404 })
  )
  .add(
    HttpApiEndpoint.post("create", "/api/exchange-rates")
      .setPayload(S.CreateExchangeRateEntry)
      .addSuccess(S.ExchangeRateEntry)
  )
  .add(
    HttpApiEndpoint.post("fetch", "/api/exchange-rates/fetch")
      .addSuccess(S.ExchangeRateEntry)
  )
  .add(
    HttpApiEndpoint.del("remove", "/api/exchange-rates/:id")
      .setPath(S.IdParam)
  )

// ---------------------------------------------------------------------------
// Sankey (computed)
// ---------------------------------------------------------------------------

const SankeyQueryParams = Schema.Struct({
  date: Schema.optional(Schema.String),
})

const SankeyApi = HttpApiGroup.make("sankey")
  .add(
    HttpApiEndpoint.get("getData", "/api/sankey")
      .setUrlParams(SankeyQueryParams)
      .addSuccess(S.SankeyData)
  )

// ---------------------------------------------------------------------------
// Evolution (computed)
// ---------------------------------------------------------------------------

const EvolutionQueryParams = Schema.Struct({
  from: Schema.optional(Schema.String),
  to: Schema.optional(Schema.String),
})

const PriceEvolutionQueryParams = Schema.Struct({
  categories: Schema.optional(Schema.String), // comma-separated IDs
  from: Schema.optional(Schema.String),
  to: Schema.optional(Schema.String),
})

const EvolutionApi = HttpApiGroup.make("evolution")
  .add(
    HttpApiEndpoint.get("prices", "/api/evolution/prices")
      .setUrlParams(PriceEvolutionQueryParams)
      .addSuccess(S.PriceEvolutionResponse)
  )
  .add(
    HttpApiEndpoint.get("exchangeRate", "/api/evolution/exchange-rate")
      .setUrlParams(EvolutionQueryParams)
      .addSuccess(S.ExchangeRateEvolutionResponse)
  )
  .add(
    HttpApiEndpoint.get("totalByLocation", "/api/evolution/total-by-location")
      .setUrlParams(EvolutionQueryParams)
      .addSuccess(S.TotalByLocationResponse)
  )

// ---------------------------------------------------------------------------
// Top-level API
// ---------------------------------------------------------------------------

export const HomeBudgetApi = HttpApi.make("homebudget")
  .add(LocationsApi)
  .add(CategoriesApi)
  .add(SalaryApi)
  .add(PricesApi)
  .add(ExchangeRatesApi)
  .add(SankeyApi)
  .add(EvolutionApi)
