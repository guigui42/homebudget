import { Effect } from "effect"

/**
 * Logs errors with context before converting to defects (500 responses).
 * Use for handlers where the endpoint has no declared error types.
 */
export const logAndDie = <A, R>(
  effect: Effect.Effect<A, unknown, R>,
  context: string,
) =>
  effect.pipe(
    Effect.tapError((e) => Effect.logError(context, e)),
    Effect.orDie,
  )
