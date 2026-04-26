import { PgClient } from "@effect/sql-pg"
import { Redacted } from "effect"

const snakeToCamel = (s: string) =>
  s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())

const url =
  process.env.DATABASE_URL ??
  "postgres://homebudget:homebudget@localhost:5435/homebudget"

export const PgLive = PgClient.layer({
  url: Redacted.make(url),
  transformResultNames: snakeToCamel,
})
