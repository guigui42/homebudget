import { HttpApiBuilder, FetchHttpClient } from "@effect/platform"
import { BunHttpServer } from "@effect/platform-bun"
import { Layer, Effect } from "effect"
import { HomeBudgetApi } from "@homebudget/shared"
import { PgLive } from "./Db/client.js"
import {
  LocationsLive,
  CategoriesLive,
  SalaryLive,
  PricesLive,
  ExchangeRatesLive,
  SankeyLive,
  EvolutionLive,
} from "./Api/handlers.js"

const ApiLive = HttpApiBuilder.api(HomeBudgetApi)

const ServerLive = HttpApiBuilder.serve().pipe(
  Layer.provide(HttpApiBuilder.middlewareCors()),
  Layer.provide(ApiLive),
  Layer.provide(LocationsLive),
  Layer.provide(CategoriesLive),
  Layer.provide(SalaryLive),
  Layer.provide(PricesLive),
  Layer.provide(ExchangeRatesLive),
  Layer.provide(SankeyLive),
  Layer.provide(EvolutionLive),
  Layer.provide(BunHttpServer.layer({ port: 3210 })),
  Layer.provide(PgLive),
  Layer.provide(FetchHttpClient.layer),
)

Layer.launch(ServerLive).pipe(
  Effect.tapErrorCause(Effect.logError),
  Effect.runFork,
)
