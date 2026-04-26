import { Effect } from "effect"

interface FrankfurterResponse {
  amount: number
  base: string
  date: string
  rates: Record<string, number>
}

export const fetchLatestEurPhp = Effect.gen(function* () {
  const response = yield* Effect.tryPromise({
    try: () => fetch("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=PHP"),
    catch: () => new Error("Failed to fetch exchange rate from Frankfurter API"),
  })

  const data = yield* Effect.tryPromise({
    try: () => response.json() as Promise<FrankfurterResponse>,
    catch: () => new Error("Failed to parse exchange rate response"),
  })

  const rate = data.rates["PHP"]
  if (rate === undefined) {
    return yield* Effect.fail(new Error("PHP rate not found in response"))
  }

  return { rate, date: data.date }
})
