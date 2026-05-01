export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: { _tag?: string; error?: string; message?: string } | null,
  ) {
    super(`API error ${status}: ${body?.message ?? body?.error ?? statusText}`)
    this.name = "ApiError"
  }

  get isNotFound() { return this.status === 404 }
  get isValidation() { return this.status === 422 }
  get isServerError() { return this.status >= 500 }
}

const API_BASE = "/api"

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })
  if (!res.ok) {
    let body: { _tag?: string; error?: string; message?: string } | null = null
    try {
      body = await res.json()
    } catch {}
    throw new ApiError(res.status, res.statusText, body)
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export interface Location {
  id: number
  name: string
  country: string
  currency: string
  sortOrder: number
  createdAt: string
}

export const locations = {
  list: () => request<Location[]>("/locations"),
  create: (data: Omit<Location, "id" | "createdAt">) =>
    request<Location>("/locations", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Omit<Location, "id" | "createdAt">>) =>
    request<Location>(`/locations/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: number) =>
    request<void>(`/locations/${id}`, { method: "DELETE" }),
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export interface ExpenseCategory {
  id: number
  locationId: number
  parentId: number | null
  name: string
  frequency: string
  color: string | null
  sortOrder: number
  createdAt: string
}

export const categories = {
  listByLocation: (locationId: number) =>
    request<ExpenseCategory[]>(`/locations/${locationId}/categories`),
  listAll: () => request<ExpenseCategory[]>("/categories"),
  create: (data: { locationId: number; parentId?: number | null; name: string; frequency?: string; color?: string; sortOrder?: number }) =>
    request<ExpenseCategory>("/categories", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Omit<ExpenseCategory, "id" | "locationId" | "createdAt">>) =>
    request<ExpenseCategory>(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: number) =>
    request<void>(`/categories/${id}`, { method: "DELETE" }),
  reorder: (items: Array<{ id: number; sortOrder: number; parentId: number | null }>) =>
    request<ExpenseCategory[]>("/categories/reorder", { method: "POST", body: JSON.stringify({ items }) }),
}

// ---------------------------------------------------------------------------
// Salary
// ---------------------------------------------------------------------------

export interface SalaryEntry {
  id: number
  amount: number
  currency: string
  effectiveFrom: string
  note: string | null
  createdAt: string
}

export const salary = {
  history: () => request<SalaryEntry[]>("/salary/history"),
  current: () => request<SalaryEntry>("/salary/current"),
  create: (data: { amount: number; currency?: string; effectiveFrom: string; note?: string }) =>
    request<SalaryEntry>("/salary", { method: "POST", body: JSON.stringify(data) }),
  remove: (id: number) =>
    request<void>(`/salary/${id}`, { method: "DELETE" }),
}

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------

export interface PriceEntry {
  id: number
  expenseCategoryId: number
  amount: number
  currency: string
  effectiveFrom: string
  note: string | null
  createdAt: string
}

export const prices = {
  history: (categoryId: number) =>
    request<PriceEntry[]>(`/prices/${categoryId}/history`),
  create: (data: { expenseCategoryId: number; amount: number; currency: string; effectiveFrom: string; note?: string }) =>
    request<PriceEntry>("/prices", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Pick<PriceEntry, "amount" | "effectiveFrom" | "note">>) =>
    request<PriceEntry>(`/prices/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: number) =>
    request<void>(`/prices/${id}`, { method: "DELETE" }),
}

// ---------------------------------------------------------------------------
// Exchange rates
// ---------------------------------------------------------------------------

export interface ExchangeRateEntry {
  id: number
  fromCurrency: string
  toCurrency: string
  rate: number
  effectiveFrom: string
  source: string
  createdAt: string
}

export const exchangeRates = {
  history: () => request<ExchangeRateEntry[]>("/exchange-rates/history"),
  current: () => request<ExchangeRateEntry>("/exchange-rates/current"),
  create: (data: { rate: number; effectiveFrom: string; fromCurrency?: string; toCurrency?: string; source?: string }) =>
    request<ExchangeRateEntry>("/exchange-rates", { method: "POST", body: JSON.stringify(data) }),
  fetch: () =>
    request<ExchangeRateEntry>("/exchange-rates/fetch", { method: "POST" }),
  remove: (id: number) =>
    request<void>(`/exchange-rates/${id}`, { method: "DELETE" }),
}

// ---------------------------------------------------------------------------
// Sankey
// ---------------------------------------------------------------------------

export interface SankeyNode {
  id: string
  name: string
  value: number
  color?: string
}

export interface SankeyLink {
  source: string
  target: string
  value: number
}

export interface SankeyData {
  nodes: SankeyNode[]
  links: SankeyLink[]
  asOf: string
  baseCurrency: string
  salaryMonthly: number
  expensesMonthly: number
  savingsMonthly: number
  exchangeRates: Record<string, number>
}

export const sankey = {
  getData: (date?: string) => {
    const params = date ? `?date=${date}` : ""
    return request<SankeyData>(`/sankey${params}`)
  },
}

// ---------------------------------------------------------------------------
// Evolution
// ---------------------------------------------------------------------------

export interface TimePoint {
  date: string
  value: number
}

export interface PriceEvolutionSeries {
  categoryId: number
  categoryName: string
  locationName: string
  currency: string
  points: TimePoint[]
}

export interface PriceEvolutionResponse {
  series: PriceEvolutionSeries[]
}

export interface ExchangeRateEvolutionResponse {
  fromCurrency: string
  toCurrency: string
  points: TimePoint[]
}

export const evolution = {
  prices: (categoryIds: number[], from?: string, to?: string) => {
    const params = new URLSearchParams()
    if (categoryIds.length) params.set("categories", categoryIds.join(","))
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    return request<PriceEvolutionResponse>(`/evolution/prices?${params}`)
  },
  exchangeRate: (from?: string, to?: string) => {
    const params = new URLSearchParams()
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    return request<ExchangeRateEvolutionResponse>(`/evolution/exchange-rate?${params}`)
  },
}
