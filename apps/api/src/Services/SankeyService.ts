import { SqlClient } from "@effect/sql"
import { Domain } from "@homebudget/shared"
import { Context, Effect, Layer } from "effect"
import type { Schemas } from "@homebudget/shared"
import * as Repo from "../Db/repos.js"

export class SankeyService extends Context.Tag("SankeyService")<
  SankeyService,
  {
    readonly computeSankey: (date: string) => Effect.Effect<Schemas.SankeyData>
  }
>() {}

const computeSankeyImpl = (date: string) =>
  Effect.gen(function* () {
    const salary = yield* Repo.salaryAtDate(date)
    if (!salary) {
      return {
        nodes: [],
        links: [],
        asOf: date,
        baseCurrency: "EUR",
        salaryMonthly: 0,
        expensesMonthly: 0,
        savingsMonthly: 0,
        exchangeRates: {},
      } satisfies Schemas.SankeyData
    }

    const locations = yield* Repo.listLocations
    const categories = yield* Repo.listAllCategories
    const prices = yield* Repo.pricesAtDate(date)
    const fxEntry = yield* Repo.exchangeRateAtDate(date)
    const phpToEur = fxEntry ? 1 / fxEntry.rate : 0

    // Build price lookup: categoryId → price row
    const priceMap = new Map<number, { amount: number; currency: string }>()
    for (const p of prices) {
      priceMap.set(p.expenseCategoryId, {
        amount: p.amount,
        currency: p.currency,
      })
    }

    // Collect nodes and links
    const nodes: Array<{ id: string; name: string; value: number; color?: string }> = []
    const links: Array<{ source: string; target: string; value: number }> = []

    const salaryMonthly = salary.amount
    nodes.push({ id: "salary", name: "Salary", value: salaryMonthly })

    let totalExpenses = 0

    for (const loc of locations) {
      const locId = `loc-${loc.id}`
      const locCategories = categories.filter(
        (c) => c.locationId === loc.id
      )

      // Separate groups (parentId=null) and leaves
      const groups = locCategories.filter(
        (c) => c.parentId === null && locCategories.some((ch) => ch.parentId === c.id)
      )
      const standaloneLeaves = locCategories.filter(
        (c) => c.parentId === null && !locCategories.some((ch) => ch.parentId === c.id)
      )

      let locTotal = 0

      // Process groups
      for (const group of groups) {
        const children = locCategories.filter((c) => c.parentId === group.id)
        let groupTotal = 0

        for (const child of children) {
          const price = priceMap.get(child.id)
          if (!price) continue

          let monthlyEur = Domain.toMonthly(price.amount, child.frequency)
          if (price.currency === "PHP") monthlyEur *= phpToEur

          const expId = `exp-${child.id}`
          nodes.push({
            id: expId,
            name: child.name,
            value: Math.round(monthlyEur * 100) / 100,
            color: child.color ?? undefined,
          })
          groupTotal += monthlyEur
        }

        if (groupTotal > 0) {
          const grpId = `grp-${group.id}`
          nodes.push({
            id: grpId,
            name: group.name,
            value: Math.round(groupTotal * 100) / 100,
            color: group.color ?? undefined,
          })
          links.push({ source: locId, target: grpId, value: Math.round(groupTotal * 100) / 100 })

          for (const child of children) {
            const price = priceMap.get(child.id)
            if (!price) continue
            let monthlyEur = Domain.toMonthly(price.amount, child.frequency)
            if (price.currency === "PHP") monthlyEur *= phpToEur
            links.push({
              source: grpId,
              target: `exp-${child.id}`,
              value: Math.round(monthlyEur * 100) / 100,
            })
          }

          locTotal += groupTotal
        }
      }

      // Process standalone leaves (no group parent)
      for (const leaf of standaloneLeaves) {
        const price = priceMap.get(leaf.id)
        if (!price) continue

        let monthlyEur = Domain.toMonthly(price.amount, leaf.frequency)
        if (price.currency === "PHP") monthlyEur *= phpToEur

        const expId = `exp-${leaf.id}`
        nodes.push({
          id: expId,
          name: leaf.name,
          value: Math.round(monthlyEur * 100) / 100,
          color: leaf.color ?? undefined,
        })
        links.push({ source: locId, target: expId, value: Math.round(monthlyEur * 100) / 100 })
        locTotal += monthlyEur
      }

      if (locTotal > 0) {
        nodes.push({
          id: locId,
          name: loc.name,
          value: Math.round(locTotal * 100) / 100,
        })
        links.push({
          source: "salary",
          target: locId,
          value: Math.round(locTotal * 100) / 100,
        })
        totalExpenses += locTotal
      }
    }

    // Savings / deficit — not included in the Sankey diagram (dominates visually),
    // but returned in the metadata for the summary cards
    const savings = salaryMonthly - totalExpenses

    // Set salary node value to total expenses so the diagram scales to expenses only
    const salaryNode = nodes.find((n) => n.id === "salary")
    if (salaryNode) {
      salaryNode.value = Math.round(totalExpenses * 100) / 100
    }

    const exchangeRates: Record<string, number> = {}
    if (fxEntry) {
      exchangeRates[`${fxEntry.fromCurrency}/${fxEntry.toCurrency}`] =
        fxEntry.rate
    }

    return {
      nodes,
      links,
      asOf: date,
      baseCurrency: "EUR",
      salaryMonthly: Math.round(salaryMonthly * 100) / 100,
      expensesMonthly: Math.round(totalExpenses * 100) / 100,
      savingsMonthly: Math.round(savings * 100) / 100,
      exchangeRates,
    } satisfies Schemas.SankeyData
  })

export const SankeyServiceLive = Layer.effect(
  SankeyService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    return SankeyService.of({
      computeSankey: (date: string) =>
        computeSankeyImpl(date).pipe(
          Effect.provideService(SqlClient.SqlClient, sql),
          Effect.tapError((e) =>
            Effect.logError({ message: "sankey computation failed", error: e })
          ),
          Effect.orDie
        ),
    })
  })
)
