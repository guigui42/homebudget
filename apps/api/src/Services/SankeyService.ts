import { Effect } from "effect"
import { Domain } from "@homebudget/shared"
import type { Schemas } from "@homebudget/shared"
import * as Repo from "../Db/repos.js"

interface CategoryWithPrice {
  id: number
  locationId: number
  parentId: number | null
  name: string
  frequency: Domain.Frequency
  color: string | null
  amount: number
  currency: string
}

export const computeSankey = (date: string) =>
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
    const phpToEur = fxEntry ? 1 / (fxEntry as any).rate : 0

    // Build price lookup: categoryId → price row
    const priceMap = new Map<number, { amount: number; currency: string }>()
    for (const p of prices as any[]) {
      priceMap.set(p.expenseCategoryId, {
        amount: p.amount,
        currency: p.currency,
      })
    }

    // Collect nodes and links
    const nodes: Array<{ id: string; name: string; value: number; color?: string }> = []
    const links: Array<{ source: string; target: string; value: number }> = []

    const salaryMonthly = (salary as any).amount as number
    nodes.push({ id: "salary", name: "Salary", value: salaryMonthly })

    let totalExpenses = 0

    for (const loc of locations as any[]) {
      const locId = `loc-${loc.id}`
      const locCategories = (categories as any[]).filter(
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

          let monthlyEur = Domain.toMonthly(price.amount, child.frequency as Domain.Frequency)
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
            let monthlyEur = Domain.toMonthly(price.amount, child.frequency as Domain.Frequency)
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

        let monthlyEur = Domain.toMonthly(price.amount, leaf.frequency as Domain.Frequency)
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

    // Savings / deficit
    const savings = salaryMonthly - totalExpenses
    if (Math.abs(savings) > 0.01) {
      const label = savings > 0 ? "Savings" : "Deficit"
      nodes.push({
        id: "savings",
        name: label,
        value: Math.round(Math.abs(savings) * 100) / 100,
        color: savings > 0 ? "#4caf50" : "#f44336",
      })
      if (savings > 0) {
        links.push({
          source: "salary",
          target: "savings",
          value: Math.round(savings * 100) / 100,
        })
      }
    }

    const exchangeRates: Record<string, number> = {}
    if (fxEntry) {
      exchangeRates[`${(fxEntry as any).fromCurrency}/${(fxEntry as any).toCurrency}`] =
        (fxEntry as any).rate
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
