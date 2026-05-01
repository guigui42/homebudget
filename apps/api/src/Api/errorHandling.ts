import { Effect } from "effect"
import { Schemas } from "@homebudget/shared"

/**
 * Logs errors with context before converting to defects (500 responses).
 * Use for handlers where the endpoint has no declared error types.
 */
export const logAndDie = <A, R>(
  effect: Effect.Effect<A, unknown, R>,
  context: string,
) =>
  effect.pipe(
    Effect.tapError((e) => Effect.logError({ context, error: e })),
    Effect.orDie,
  )

/**
 * Logs errors with context, lets NotFoundError propagate as 404,
 * and converts all other errors to defects (500 responses).
 */
export const logAndDieUnlessNotFound = <A, R>(
  effect: Effect.Effect<A, Schemas.NotFoundError | (unknown & {}), R>,
  context: string,
) =>
  effect.pipe(
    Effect.tapError((e) => Effect.logError({ context, error: e })),
    Effect.catchAll((error) =>
      error instanceof Schemas.NotFoundError
        ? Effect.fail(error)
        : Effect.die(error)
    ),
  )
