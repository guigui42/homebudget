import { useState, useEffect, useCallback } from "react"
import {
  Container,
  Title,
  MultiSelect,
  Group,
  Paper,
  Tabs,
  Loader,
  Center,
  Text,
} from "@mantine/core"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { categories, evolution } from "../api/client"
import { CHART_COLORS as COLORS } from "../constants"
import type {
  ExpenseCategory,
  PriceEvolutionSeries,
  TimePoint,
} from "../api/client"

export function EvolutionPage() {
  const [allCategories, setAllCategories] = useState<ExpenseCategory[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [priceSeries, setPriceSeries] = useState<PriceEvolutionSeries[]>([])
  const [fxPoints, setFxPoints] = useState<TimePoint[]>([])
  const [loading, setLoading] = useState(false)

  // Load categories on mount
  useEffect(() => {
    categories.listAll().then(setAllCategories)
  }, [])

  // Leaf categories only (the ones with prices)
  const leafCategories = allCategories.filter((c) => !allCategories.some(ch => ch.parentId === c.id))

  const categoryOptions = leafCategories.map((c) => ({
    value: String(c.id),
    label: `${c.name} (${allCategories.find(l => l.id === c.locationId)?.name ?? ""})`.trim(),
  }))

  const loadPrices = useCallback(async () => {
    if (selectedIds.length === 0) {
      setPriceSeries([])
      return
    }
    setLoading(true)
    try {
      const result = await evolution.prices(selectedIds.map(Number))
      setPriceSeries(result.series)
    } catch {
      setPriceSeries([])
    } finally {
      setLoading(false)
    }
  }, [selectedIds])

  useEffect(() => {
    loadPrices()
  }, [loadPrices])

  // Load FX on mount
  useEffect(() => {
    evolution.exchangeRate().then((r) => setFxPoints(r.points))
  }, [])

  // Merge price series into a flat array for recharts
  const priceChartData = (() => {
    const dateMap = new Map<string, Record<string, number>>()
    for (const series of priceSeries) {
      for (const pt of series.points) {
        const row = dateMap.get(pt.date) ?? {}
        row[series.categoryName] = pt.value
        dateMap.set(pt.date, row)
      }
    }
    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }))
  })()

  return (
    <Container size="xl" py="lg">
      <Title order={2} mb="lg">
        Price Evolution
      </Title>

      <Tabs defaultValue="prices">
        <Tabs.List mb="md">
          <Tabs.Tab value="prices">Expense Prices</Tabs.Tab>
          <Tabs.Tab value="fx">Exchange Rate</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="prices">
          <Group mb="md">
            <MultiSelect
              data={categoryOptions}
              value={selectedIds}
              onChange={setSelectedIds}
              placeholder="Select expense categories"
              searchable
              clearable
              w={400}
            />
          </Group>

          {loading ? (
            <Center h={300}>
              <Loader />
            </Center>
          ) : priceChartData.length > 0 ? (
            <Paper withBorder p="md">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={priceChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {priceSeries.map((s, i) => (
                    <Line
                      key={s.categoryId}
                      type="stepAfter"
                      dataKey={s.categoryName}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          ) : (
            <Text c="dimmed" ta="center" py="xl">
              {selectedIds.length === 0
                ? "Select categories to see price evolution"
                : "No price history for selected categories"}
            </Text>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="fx">
          <Paper withBorder p="md">
            {fxPoints.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={fxPoints}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={["auto", "auto"]} />
                  <Tooltip
                    formatter={(value: number) =>
                      `1 EUR = ${value.toFixed(4)} PHP`
                    }
                  />
                  <Line
                    type="stepAfter"
                    dataKey="value"
                    name="EUR/PHP"
                    stroke="#4e79a7"
                    strokeWidth={2}
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Text c="dimmed" ta="center" py="xl">
                No exchange rate history yet
              </Text>
            )}
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Container>
  )
}
