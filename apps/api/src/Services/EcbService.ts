import { Effect, Data } from "effect"

export class EcbFetchError extends Data.TaggedError("EcbFetchError")<{
  readonly message: string
}> {}

export class EcbParseError extends Data.TaggedError("EcbParseError")<{
  readonly message: string
}> {}

export class EcbMissingRateError extends Data.TaggedError("EcbMissingRateError")<{
  readonly message: string
}> {}

interface FrankfurterResponse {
  amount: number
  base: string
  date: string
  rates: Record<string, number>
}

export const fetchLatestEurPhp = Effect.gen(function* () {
  const response = yield* Effect.tryPromise({
    try: () => fetch("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=PHP"),
    catch: (cause) => new EcbFetchError({ message: `Network error: ${cause}` }),
  })

  if (!response.ok) {
    return yield* Effect.fail(
      new EcbFetchError({ message: `Frankfurter API returned ${response.status}` })
    )
  }

  const data = yield* Effect.tryPromise({
    try: () => response.json() as Promise<FrankfurterResponse>,
    catch: (cause) => new EcbParseError({ message: `Failed to parse response: ${cause}` }),
  })

  const rate = data.rates["PHP"]
  if (rate === undefined) {
    return yield* Effect.fail(
      new EcbMissingRateError({ message: "PHP rate not found in response" })
    )
  }

  return { rate, date: data.date }
})
