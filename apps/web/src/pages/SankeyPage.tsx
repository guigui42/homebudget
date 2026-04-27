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
  Loader,
  Center,
  ThemeIcon,
  Stack,
  Skeleton,
  Badge,
} from "@mantine/core"
import { DatePickerInput } from "@mantine/dates"
import {
  IconCash,
  IconReceipt,
  IconPigMoney,
  IconCurrencyEuro,
  IconAlertTriangle,
} from "@tabler/icons-react"
import { SankeyChart } from "../components/SankeyChart"
import { sankey, type SankeyData } from "../api/client"

function fmt(n: number) {
  return `€${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  valueColor,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ size?: number; stroke?: number }>
  color: string
  valueColor?: string
}) {
  return (
    <Card withBorder padding="lg">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Text size="sm" c="dimmed" fw={500}>
            {label}
          </Text>
          <Text size="xl" fw={700} c={valueColor} style={{ fontVariantNumeric: "tabular-nums" }}>
            {value}
          </Text>
        </Stack>
        <ThemeIcon variant="light" size="xl" radius="md" color={color}>
          <Icon size={22} stroke={1.5} />
        </ThemeIcon>
      </Group>
    </Card>
  )
}

function LoadingSkeleton() {
  return (
    <>
      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="lg">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} withBorder padding="lg">
            <Group justify="space-between">
              <Stack gap={8}>
                <Skeleton height={14} width={100} />
                <Skeleton height={28} width={80} />
              </Stack>
              <Skeleton height={42} width={42} radius="md" />
            </Group>
          </Card>
        ))}
      </SimpleGrid>
      <Skeleton height={400} radius="md" />
    </>
  )
}

export function SankeyPage() {
  const { ref: chartRef, width: chartWidth } = useElementSize()
  const [dateStr, setDateStr] = useState<string>(todayStr())
  const [data, setData] = useState<SankeyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await sankey.getData(dateStr || undefined)
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [dateStr])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Container size="xl" py="lg">
      <Group justify="space-between" mb="xl" wrap="wrap">
        <Title order={2}>Budget Overview</Title>
        <DatePickerInput
          label="As of date"
          value={dateStr}
          onChange={(v) => setDateStr(v ?? todayStr())}
          clearable={false}
          w={200}
        />
      </Group>

      {error && (
        <Paper withBorder p="md" mb="lg" bg="var(--mantine-color-red-light)">
          <Group gap="sm">
            <IconAlertTriangle size={20} color="var(--mantine-color-red-filled)" />
            <Text c="red" fw={500}>{error}</Text>
          </Group>
        </Paper>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : data ? (
        <>
          <SimpleGrid cols={{ base: 2, sm: 4 }} mb="xl">
            <StatCard
              label="Monthly Salary"
              value={fmt(data.salaryMonthly)}
              icon={IconCash}
              color="blue"
            />
            <StatCard
              label="Monthly Expenses"
              value={fmt(data.expensesMonthly)}
              icon={IconReceipt}
              color="orange"
            />
            <StatCard
              label={data.savingsMonthly >= 0 ? "Savings" : "Deficit"}
              value={fmt(Math.abs(data.savingsMonthly))}
              icon={IconPigMoney}
              color={data.savingsMonthly >= 0 ? "teal" : "red"}
              valueColor={data.savingsMonthly >= 0 ? "teal" : "red"}
            />
            <StatCard
              label="EUR/PHP Rate"
              value={data.exchangeRates["EUR/PHP"]?.toFixed(2) ?? "—"}
              icon={IconCurrencyEuro}
              color="grape"
            />
          </SimpleGrid>

          <Paper ref={chartRef} withBorder p="md" style={{ overflowX: 'auto' }}>
            <SankeyChart data={data} width={Math.max(600, (chartWidth || 900) - 32)} height={Math.max(400, data.nodes.length * 40)} />
          </Paper>

          <Group mt="sm" gap="xs">
            <Badge variant="light" size="sm" radius="md">
              Date: {data.asOf}
            </Badge>
            <Badge variant="light" size="sm" color="gray" radius="md">
              Base: {data.baseCurrency}
            </Badge>
          </Group>
        </>
      ) : null}
    </Container>
  )
}
