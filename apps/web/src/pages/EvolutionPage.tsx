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
  Stack,
  ThemeIcon,
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
import {
  IconChartLine,
  IconArrowsExchange,
  IconChartAreaLine,
} from "@tabler/icons-react"
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

  useEffect(() => {
    categories.listAll().then(setAllCategories)
  }, [])

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

  useEffect(() => {
    evolution.exchangeRate().then((r) => setFxPoints(r.points))
  }, [])

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
      <Title order={2} mb="xl">
        Price Evolution
      </Title>

      <Tabs defaultValue="prices" variant="pills" radius="md">
        <Tabs.List mb="lg">
          <Tabs.Tab value="prices" leftSection={<IconChartLine size={16} stroke={1.5} />}>
            Expense Prices
          </Tabs.Tab>
          <Tabs.Tab value="fx" leftSection={<IconArrowsExchange size={16} stroke={1.5} />}>
            Exchange Rate
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="prices">
          <Group mb="lg">
            <MultiSelect
              data={categoryOptions}
              value={selectedIds}
              onChange={setSelectedIds}
              placeholder="Select expense categories"
              searchable
              clearable
              w={450}
            />
          </Group>

          {loading ? (
            <Center h={300}>
              <Loader />
            </Center>
          ) : priceChartData.length > 0 ? (
            <Paper withBorder p="lg">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={priceChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-default-border)" strokeOpacity={0.5} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--mantine-color-body)",
                      border: "1px solid var(--mantine-color-default-border)",
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  />
                  <Legend />
                  {priceSeries.map((s, i) => (
                    <Line
                      key={s.categoryId}
                      type="stepAfter"
                      dataKey={s.categoryName}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          ) : (
            <Paper withBorder p="xl">
              <Stack align="center" gap="md" py="xl">
                <ThemeIcon variant="light" size="xl" radius="xl" color="gray">
                  <IconChartAreaLine size={24} stroke={1.5} />
                </ThemeIcon>
                <Text c="dimmed" ta="center" size="sm">
                  {selectedIds.length === 0
                    ? "Select categories above to see price evolution"
                    : "No price history for selected categories"}
                </Text>
              </Stack>
            </Paper>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="fx">
          <Paper withBorder p="lg">
            {fxPoints.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={fxPoints}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-default-border)" strokeOpacity={0.5} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) =>
                      value != null ? `1 EUR = ${Number(value).toFixed(4)} PHP` : "—"
                    }
                    contentStyle={{
                      backgroundColor: "var(--mantine-color-body)",
                      border: "1px solid var(--mantine-color-default-border)",
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  />
                  <Line
                    type="stepAfter"
                    dataKey="value"
                    name="EUR/PHP"
                    stroke={COLORS[0]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Stack align="center" gap="md" py="xl">
                <ThemeIcon variant="light" size="xl" radius="xl" color="gray">
                  <IconArrowsExchange size={24} stroke={1.5} />
                </ThemeIcon>
                <Text c="dimmed" ta="center" size="sm">
                  No exchange rate history yet
                </Text>
              </Stack>
            )}
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Container>
  )
}
