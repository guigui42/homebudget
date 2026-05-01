import { HttpClient } from "@effect/platform"
import { Context, Data, Effect, Layer, Schema } from "effect"

export class EcbFetchError extends Data.TaggedError("EcbFetchError")<{
  readonly message: string
}> {}

export class EcbParseError extends Data.TaggedError("EcbParseError")<{
  readonly message: string
}> {}

export class EcbMissingRateError extends Data.TaggedError("EcbMissingRateError")<{
  readonly message: string
}> {}

const FrankfurterResponse = Schema.Struct({
  amount: Schema.Number,
  base: Schema.String,
  date: Schema.String,
  rates: Schema.Record({ key: Schema.String, value: Schema.Number }),
})

export class EcbService extends Context.Tag("EcbService")<
  EcbService,
  {
    readonly fetchLatestEurPhp: Effect.Effect<
      { rate: number; date: string },
      EcbFetchError | EcbParseError | EcbMissingRateError
    >
  }
>() {}

export const EcbServiceLive = Layer.effect(
  EcbService,
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient

    return EcbService.of({
      fetchLatestEurPhp: Effect.gen(function* () {
        const response = yield* client.get("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=PHP").pipe(
          Effect.mapError((cause) => new EcbFetchError({ message: `Network error: ${cause}` }))
        )

        if (response.status >= 400) {
          return yield* Effect.fail(
            new EcbFetchError({ message: `Frankfurter API returned ${response.status}` })
          )
        }

        const raw = yield* response.json.pipe(
          Effect.mapError(() => new EcbParseError({ message: "Failed to parse exchange rate response" }))
        )

        const data = yield* Schema.decodeUnknown(FrankfurterResponse)(raw).pipe(
          Effect.mapError(() => new EcbParseError({ message: "Unexpected response shape from Frankfurter API" }))
        )

        const rate = data.rates["PHP"]
        if (rate === undefined) {
          return yield* Effect.fail(
            new EcbMissingRateError({ message: "PHP rate not found in response" })
          )
        }

        return { rate, date: data.date }
      }),
    })
  })
)
