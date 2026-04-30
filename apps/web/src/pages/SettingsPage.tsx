import { useState, useEffect, useCallback } from "react"
import { formatNumber } from "../utils/format"
import {
  Container,
  Title,
  Tabs,
  Table,
  Button,
  Group,
  TextInput,
  NumberInput,
  Select,
  Modal,
  ActionIcon,
  Text,
  Badge,
  Stack,
  Paper,
  Box,
  Tooltip,
  Skeleton,
  ThemeIcon,
} from "@mantine/core"
import { DatePickerInput } from "@mantine/dates"
import { useDisclosure } from "@mantine/hooks"
import { modals } from "@mantine/modals"
import { notifications } from "@mantine/notifications"
import {
  IconPlus,
  IconTrash,
  IconCheck,
  IconX,
  IconMapPin,
  IconCategory,
  IconCash,
  IconArrowsExchange,
  IconDownload,
} from "@tabler/icons-react"
import {
  locations,
  salary,
  exchangeRates,
} from "../api/client"
import type {
  Location,
  SalaryEntry,
  ExchangeRateEntry,
} from "../api/client"
import { fromIsoDate, pickerValueToIso } from "../utils/date.js"
import { CategoriesTab } from "../components/CategoriesTab"

/** Safely parse a NumberInput value to a finite number, or return undefined. */
function parseFinite(v: number | string): number | undefined {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : undefined
}

// ---------------------------------------------------------------------------
// Locations Tab
// ---------------------------------------------------------------------------

function LocationsTab() {
  const [items, setItems] = useState<Location[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [opened, { open, close }] = useDisclosure(false)
  const [form, setForm] = useState({ name: "", country: "", currency: "EUR" })

  const load = useCallback(() => {
    locations.list().then((data) => { setItems(data); setLoading(false) }).catch(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  const submit = async () => {
    try {
      await locations.create({ ...form, sortOrder: items.length })
      notifications.show({ title: "Success", message: "Location created", color: "teal", icon: <IconCheck size={16} /> })
      close()
      setForm({ name: "", country: "", currency: "EUR" })
      load()
    } catch (e) {
      console.error("Failed to create location:", e)
      notifications.show({ title: "Error", message: "Failed to create location", color: "red", icon: <IconX size={16} /> })
    }
  }

  if (loading) return <Stack gap="md"><Skeleton height={40} /><Skeleton height={200} /></Stack>

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={4}>Locations</Title>
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={open}>Add Location</Button>
      </Group>
      {items.length === 0 ? (
        <Paper withBorder p="xl">
          <Stack align="center" gap="md" py="xl">
            <ThemeIcon variant="light" size="xl" radius="xl" color="gray">
              <IconMapPin size={24} stroke={1.5} />
            </ThemeIcon>
            <Text c="dimmed" ta="center" size="sm">
              No locations yet. Click &quot;Add Location&quot; to get started.
            </Text>
          </Stack>
        </Paper>
      ) : (
        <Box style={{ overflowX: "auto" }}>
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Country</Table.Th>
                <Table.Th>Currency</Table.Th>
                <Table.Th w={60} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((loc) => (
                <Table.Tr key={loc.id}>
                  <Table.Td>{loc.name}</Table.Td>
                  <Table.Td>{loc.country}</Table.Td>
                  <Table.Td><Badge variant="light">{loc.currency}</Badge></Table.Td>
                  <Table.Td>
                    <Tooltip label="Delete" withArrow>
                      <ActionIcon variant="subtle" color="red" size="md" aria-label="Delete location" onClick={() => modals.openConfirmModal({
                        title: 'Delete location',
                        children: <Text size="sm">Are you sure you want to delete &quot;{loc.name}&quot;? This cannot be undone.</Text>,
                        labels: { confirm: 'Delete', cancel: 'Cancel' },
                        confirmProps: { color: 'red' },
                        onConfirm: async () => {
                          try {
                            await locations.remove(loc.id)
                            notifications.show({ title: "Success", message: "Location deleted", color: "teal", icon: <IconCheck size={16} /> })
                            load()
                          } catch (e) {
                            console.error('Failed to delete location:', e)
                            notifications.show({ title: "Error", message: "Failed to delete location", color: "red", icon: <IconX size={16} /> })
                          }
                        },
                      })}>
                        <IconTrash size={14} stroke={1.5} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>
      )}

      <Modal opened={opened} onClose={close} title="Add Location">
        <Stack>
          <TextInput label="Name" placeholder="Maison France" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} withAsterisk />
          <TextInput label="Country" placeholder="FR" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          <Select label="Currency" data={["EUR", "PHP"]} value={form.currency} onChange={(v) => setForm({ ...form, currency: v ?? "EUR" })} />
          <Button onClick={submit} disabled={!form.name} leftSection={<IconCheck size={16} />}>Save</Button>
        </Stack>
      </Modal>
    </>
  )
}

// ---------------------------------------------------------------------------
// Salary Tab
// ---------------------------------------------------------------------------
// Salary Tab
// ---------------------------------------------------------------------------

function SalaryTab() {
  const [items, setItems] = useState<SalaryEntry[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [opened, { open, close }] = useDisclosure(false)
  const [form, setForm] = useState({ amount: 0 as number | string, effectiveFrom: "" as string, note: "" })

  const load = useCallback(() => {
    salary.history().then((data) => { setItems(data); setLoading(false) }).catch(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  const submit = async () => {
    try {
      const amount = parseFinite(form.amount)
      if (amount == null) return
      await salary.create({ amount, effectiveFrom: form.effectiveFrom, note: form.note || undefined })
      notifications.show({ title: "Success", message: "Salary entry created", color: "teal", icon: <IconCheck size={16} /> })
      close()
      setForm({ amount: 0, effectiveFrom: "", note: "" })
      load()
    } catch (e) {
      console.error("Failed to create salary entry:", e)
      notifications.show({ title: "Error", message: "Failed to create salary entry", color: "red", icon: <IconX size={16} /> })
    }
  }

  if (loading) return <Stack gap="md"><Skeleton height={40} /><Skeleton height={200} /></Stack>

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={4}>Salary History</Title>
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={open}>Add Entry</Button>
      </Group>
      {items.length === 0 ? (
        <Paper withBorder p="xl">
          <Stack align="center" gap="md" py="xl">
            <ThemeIcon variant="light" size="xl" radius="xl" color="gray">
              <IconCash size={24} stroke={1.5} />
            </ThemeIcon>
            <Text c="dimmed" ta="center" size="sm">
              No salary entries yet. Click &quot;Add Entry&quot; to get started.
            </Text>
          </Stack>
        </Paper>
      ) : (
        <Box style={{ overflowX: "auto" }}>
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Effective From</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>Currency</Table.Th>
                <Table.Th>Note</Table.Th>
                <Table.Th w={60} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((entry) => (
                <Table.Tr key={entry.id}>
                  <Table.Td>{entry.effectiveFrom}</Table.Td>
                  <Table.Td fw={600} style={{ fontVariantNumeric: "tabular-nums" }}>{formatNumber(entry.amount)}</Table.Td>
                  <Table.Td>{entry.currency}</Table.Td>
                  <Table.Td><Text size="sm" c="dimmed">{entry.note ?? ""}</Text></Table.Td>
                  <Table.Td>
                    <Tooltip label="Delete" withArrow>
                      <ActionIcon variant="subtle" color="red" size="md" aria-label="Delete salary entry" onClick={() => modals.openConfirmModal({
                        title: 'Delete salary entry',
                        children: <Text size="sm">Are you sure you want to delete the salary entry from {entry.effectiveFrom}? This cannot be undone.</Text>,
                        labels: { confirm: 'Delete', cancel: 'Cancel' },
                        confirmProps: { color: 'red' },
                        onConfirm: async () => {
                          try {
                            await salary.remove(entry.id)
                            notifications.show({ title: "Success", message: "Salary entry deleted", color: "teal", icon: <IconCheck size={16} /> })
                            load()
                          } catch (e) {
                            console.error('Failed to delete salary entry:', e)
                            notifications.show({ title: "Error", message: "Failed to delete salary entry", color: "red", icon: <IconX size={16} /> })
                          }
                        },
                      })}>
                        <IconTrash size={14} stroke={1.5} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>
      )}

      <Modal opened={opened} onClose={close} title="Add Salary Entry">
        <Stack>
          <NumberInput label="Monthly Amount (EUR)" value={form.amount} onChange={(v) => setForm({ ...form, amount: Number(v) })} min={0} withAsterisk />
          <DatePickerInput
            label="Effective From"
            value={fromIsoDate(form.effectiveFrom)}
            onChange={(v) => setForm({ ...form, effectiveFrom: v ? pickerValueToIso(v) : "" })}
            clearable
            withAsterisk
          />
          <TextInput label="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <Button onClick={submit} disabled={parseFinite(form.amount) == null || !form.effectiveFrom} leftSection={<IconCheck size={16} />}>Save</Button>
        </Stack>
      </Modal>
    </>
  )
}

// ---------------------------------------------------------------------------
// Exchange Rates Tab
// ---------------------------------------------------------------------------

function ExchangeRatesTab() {
  const [items, setItems] = useState<ExchangeRateEntry[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [opened, { open, close }] = useDisclosure(false)
  const [form, setForm] = useState({ rate: 0 as number | string, effectiveFrom: "" as string })
  const [fetching, setFetching] = useState(false)

  const load = useCallback(() => {
    exchangeRates.history().then((data) => { setItems(data); setLoading(false) }).catch(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  const submit = async () => {
    try {
      const rate = parseFinite(form.rate)
      if (rate == null) return
      await exchangeRates.create({ rate, effectiveFrom: form.effectiveFrom })
      notifications.show({ title: "Success", message: "Exchange rate created", color: "teal", icon: <IconCheck size={16} /> })
      close()
      setForm({ rate: 0, effectiveFrom: "" })
      load()
    } catch (e) {
      console.error("Failed to create exchange rate:", e)
      notifications.show({ title: "Error", message: "Failed to create exchange rate", color: "red", icon: <IconX size={16} /> })
    }
  }

  const fetchEcb = async () => {
    setFetching(true)
    try {
      await exchangeRates.fetch()
      notifications.show({ title: "Success", message: "ECB rate fetched", color: "teal", icon: <IconCheck size={16} /> })
      load()
    } catch (e) {
      console.error("Failed to fetch ECB rate:", e)
      notifications.show({ title: "Error", message: "Failed to fetch ECB rate", color: "red", icon: <IconX size={16} /> })
    } finally {
      setFetching(false)
    }
  }

  if (loading) return <Stack gap="md"><Skeleton height={40} /><Skeleton height={200} /></Stack>

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={4}>Exchange Rate History (EUR → PHP)</Title>
        <Group>
          <Button size="xs" variant="light" leftSection={<IconDownload size={14} />} onClick={fetchEcb} loading={fetching}>
            Fetch ECB Rate
          </Button>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={open}>Manual Entry</Button>
        </Group>
      </Group>
      {items.length === 0 ? (
        <Paper withBorder p="xl">
          <Stack align="center" gap="md" py="xl">
            <ThemeIcon variant="light" size="xl" radius="xl" color="gray">
              <IconArrowsExchange size={24} stroke={1.5} />
            </ThemeIcon>
            <Text c="dimmed" ta="center" size="sm">
              No exchange rates yet. Click &quot;Manual Entry&quot; to get started.
            </Text>
          </Stack>
        </Paper>
      ) : (
        <Box style={{ overflowX: "auto" }}>
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Effective From</Table.Th>
                <Table.Th>Rate (1 EUR =)</Table.Th>
                <Table.Th>Source</Table.Th>
                <Table.Th w={60} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((entry) => (
                <Table.Tr key={entry.id}>
                  <Table.Td>{entry.effectiveFrom}</Table.Td>
                  <Table.Td fw={600} style={{ fontVariantNumeric: "tabular-nums" }}>{entry.rate.toFixed(4)} PHP</Table.Td>
                  <Table.Td><Badge size="sm" variant="light" color={entry.source === "ecb" ? "blue" : "gray"}>{entry.source}</Badge></Table.Td>
                  <Table.Td>
                    <Tooltip label="Delete" withArrow>
                      <ActionIcon variant="subtle" color="red" size="md" aria-label="Delete exchange rate" onClick={() => modals.openConfirmModal({
                        title: 'Delete exchange rate',
                        children: <Text size="sm">Are you sure you want to delete the exchange rate from {entry.effectiveFrom}? This cannot be undone.</Text>,
                        labels: { confirm: 'Delete', cancel: 'Cancel' },
                        confirmProps: { color: 'red' },
                        onConfirm: async () => {
                          try {
                            await exchangeRates.remove(entry.id)
                            notifications.show({ title: "Success", message: "Exchange rate deleted", color: "teal", icon: <IconCheck size={16} /> })
                            load()
                          } catch (e) {
                            console.error('Failed to delete exchange rate:', e)
                            notifications.show({ title: "Error", message: "Failed to delete exchange rate", color: "red", icon: <IconX size={16} /> })
                          }
                        },
                      })}>
                        <IconTrash size={14} stroke={1.5} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>
      )}

      <Modal opened={opened} onClose={close} title="Add Exchange Rate">
        <Stack>
          <NumberInput label="Rate (1 EUR = X PHP)" value={form.rate} onChange={(v) => setForm({ ...form, rate: Number(v) })} min={0} decimalScale={6} withAsterisk />
          <DatePickerInput
            label="Effective From"
            value={fromIsoDate(form.effectiveFrom)}
            onChange={(v) => setForm({ ...form, effectiveFrom: v ? pickerValueToIso(v) : "" })}
            clearable
            withAsterisk
          />
          <Button onClick={submit} disabled={parseFinite(form.rate) == null || !form.effectiveFrom} leftSection={<IconCheck size={16} />}>Save</Button>
        </Stack>
      </Modal>
    </>
  )
}

// ---------------------------------------------------------------------------
// Settings Page (combines all tabs)
// ---------------------------------------------------------------------------

export function SettingsPage() {
  return (
    <Container size="xl" py="lg">
      <Title order={2} mb="xl">
        Settings
      </Title>

      <Tabs defaultValue="locations" variant="pills" radius="md">
        <Tabs.List mb="lg" style={{ flexWrap: "nowrap", overflowX: "auto" }}>
          <Tabs.Tab value="locations" leftSection={<IconMapPin size={16} stroke={1.5} />}>Locations</Tabs.Tab>
          <Tabs.Tab value="categories" leftSection={<IconCategory size={16} stroke={1.5} />}>Categories &amp; Prices</Tabs.Tab>
          <Tabs.Tab value="salary" leftSection={<IconCash size={16} stroke={1.5} />}>Salary</Tabs.Tab>
          <Tabs.Tab value="exchangeRates" leftSection={<IconArrowsExchange size={16} stroke={1.5} />}>Exchange Rates</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="locations"><LocationsTab /></Tabs.Panel>
        <Tabs.Panel value="categories"><CategoriesTab /></Tabs.Panel>
        <Tabs.Panel value="salary"><SalaryTab /></Tabs.Panel>
        <Tabs.Panel value="exchangeRates"><ExchangeRatesTab /></Tabs.Panel>
      </Tabs>
    </Container>
  )
}
