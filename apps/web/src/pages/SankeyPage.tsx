import { useState, useEffect, useCallback } from "react"
import { useElementSize } from "@mantine/hooks"
import {
  Container,
  Group,
  Paper,
  Title,
  Text,
  SimpleGrid,
  Card,
  Badge,
  Loader,
  Center,
} from "@mantine/core"
import { DatePickerInput } from "@mantine/dates"
import { SankeyChart } from "../components/SankeyChart"
import { sankey, type SankeyData } from "../api/client"

function fmt(n: number) {
  return `€${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function SankeyPage() {
  const { ref: chartRef, width: chartWidth } = useElementSize()
  const [date, setDate] = useState<Date | null>(new Date())
  const [data, setData] = useState<SankeyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const dateStr = date
        ? date.toISOString().slice(0, 10)
        : undefined
      const result = await sankey.getData(dateStr)
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Container size="xl" py="lg">
      <Group justify="space-between" mb="lg">
        <Title order={2}>Budget Overview</Title>
        <DatePickerInput
          label="As of date"
          value={date}
          onChange={setDate}
          clearable={false}
          w={200}
        />
      </Group>

      {error && (
        <Text c="red" mb="md">
          {error}
        </Text>
      )}

      {loading ? (
        <Center h={400}>
          <Loader size="lg" />
        </Center>
      ) : data ? (
        <>
          <SimpleGrid cols={{ base: 2, sm: 4 }} mb="lg">
            <Card withBorder>
              <Text size="sm" c="dimmed">
                Monthly Salary
              </Text>
              <Text size="xl" fw={700}>
                {fmt(data.salaryMonthly)}
              </Text>
            </Card>
            <Card withBorder>
              <Text size="sm" c="dimmed">
                Monthly Expenses
              </Text>
              <Text size="xl" fw={700}>
                {fmt(data.expensesMonthly)}
              </Text>
            </Card>
            <Card withBorder>
              <Text size="sm" c="dimmed">
                {data.savingsMonthly >= 0 ? "Savings" : "Deficit"}
              </Text>
              <Text
                size="xl"
                fw={700}
                c={data.savingsMonthly >= 0 ? "green" : "red"}
              >
                {fmt(Math.abs(data.savingsMonthly))}
              </Text>
            </Card>
            <Card withBorder>
              <Text size="sm" c="dimmed">
                EUR/PHP Rate
              </Text>
              <Text size="xl" fw={700}>
                {data.exchangeRates["EUR/PHP"]?.toFixed(2) ?? "—"}
              </Text>
            </Card>
          </SimpleGrid>

          <Paper ref={chartRef} withBorder p="md" style={{ overflowX: 'auto' }}>
            <SankeyChart data={data} width={Math.max(600, (chartWidth || 900) - 32)} height={Math.max(400, data.nodes.length * 40)} />
          </Paper>

          <Group mt="sm">
            <Badge variant="light" size="sm">
              Date: {data.asOf}
            </Badge>
            <Badge variant="light" size="sm" color="gray">
              Base: {data.baseCurrency}
            </Badge>
          </Group>
        </>
      ) : null}
    </Container>
  )
}
