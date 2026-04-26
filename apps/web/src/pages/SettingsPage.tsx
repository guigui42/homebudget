import { useState, useEffect, useCallback } from "react"
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
} from "@mantine/core"
import { DatePickerInput } from "@mantine/dates"
import { useDisclosure } from "@mantine/hooks"
import { modals } from "@mantine/modals"
import {
  locations,
  categories,
  salary,
  prices,
  exchangeRates,
} from "../api/client"
import type {
  Location,
  ExpenseCategory,
  SalaryEntry,
  PriceEntry,
  ExchangeRateEntry,
} from "../api/client"

// ---------------------------------------------------------------------------
// Locations Tab
// ---------------------------------------------------------------------------

function LocationsTab() {
  const [items, setItems] = useState<Location[]>([])
  const [opened, { open, close }] = useDisclosure(false)
  const [form, setForm] = useState({ name: "", country: "", currency: "EUR" })

  const load = useCallback(() => { locations.list().then(setItems) }, [])
  useEffect(load, [load])

  const submit = async () => {
    await locations.create({ ...form, sortOrder: items.length })
    close()
    setForm({ name: "", country: "", currency: "EUR" })
    load()
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={4}>Locations</Title>
        <Button size="xs" onClick={open}>+ Add Location</Button>
      </Group>
      <Table striped withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Country</Table.Th>
            <Table.Th>Currency</Table.Th>
            <Table.Th w={80} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((loc) => (
            <Table.Tr key={loc.id}>
              <Table.Td>{loc.name}</Table.Td>
              <Table.Td>{loc.country}</Table.Td>
              <Table.Td><Badge variant="light">{loc.currency}</Badge></Table.Td>
              <Table.Td>
                <ActionIcon variant="subtle" color="red" size="sm" onClick={() => modals.openConfirmModal({
                  title: 'Delete location',
                  children: <Text size="sm">Are you sure you want to delete &quot;{loc.name}&quot;? This cannot be undone.</Text>,
                  labels: { confirm: 'Delete', cancel: 'Cancel' },
                  confirmProps: { color: 'red' },
                  onConfirm: async () => { try { await locations.remove(loc.id); load() } catch (e) { console.error('Failed to delete location:', e) } },
                })}>✕</ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Modal opened={opened} onClose={close} title="Add Location">
        <Stack>
          <TextInput label="Name" placeholder="Maison France" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextInput label="Country" placeholder="FR" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          <Select label="Currency" data={["EUR", "PHP"]} value={form.currency} onChange={(v) => setForm({ ...form, currency: v ?? "EUR" })} />
          <Button onClick={submit} disabled={!form.name}>Save</Button>
        </Stack>
      </Modal>
    </>
  )
}

// ---------------------------------------------------------------------------
// Categories Tab
// ---------------------------------------------------------------------------

function CategoriesTab() {
  const [locs, setLocs] = useState<Location[]>([])
  const [items, setItems] = useState<ExpenseCategory[]>([])
  const [opened, { open, close }] = useDisclosure(false)
  const [form, setForm] = useState({ locationId: 0, parentId: null as number | null, name: "", frequency: "monthly", color: "" })

  const load = useCallback(() => {
    locations.list().then(setLocs)
    categories.listAll().then(setItems)
  }, [])
  useEffect(load, [load])

  const groups = items.filter((c) => c.parentId === null && items.some((ch) => ch.parentId === c.id))
  const parentOptions = [
    { value: "", label: "(no group)" },
    ...groups.map((g) => ({ value: String(g.id), label: `${g.name} (${locs.find((l) => l.id === g.locationId)?.name ?? ""})` })),
  ]

  const submit = async () => {
    await categories.create({
      locationId: form.locationId,
      parentId: form.parentId,
      name: form.name,
      frequency: form.frequency,
      color: form.color || undefined,
    })
    close()
    setForm({ locationId: 0, parentId: null, name: "", frequency: "monthly", color: "" })
    load()
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={4}>Expense Categories</Title>
        <Button size="xs" onClick={open}>+ Add Category</Button>
      </Group>
      {locs.map((loc) => {
        const locCats = items.filter((c) => c.locationId === loc.id)
        const topLevel = locCats.filter((c) => c.parentId === null)
        return (
          <Paper key={loc.id} withBorder p="sm" mb="md">
            <Text fw={600} mb="xs">{loc.name} <Badge size="xs" variant="light">{loc.currency}</Badge></Text>
            <Table striped>
              <Table.Tbody>
                {topLevel.map((cat) => {
                  const children = locCats.filter((c) => c.parentId === cat.id)
                  return (
                    <Table.Tr key={cat.id}>
                      <Table.Td>
                        {children.length > 0 ? (
                          <div>
                            <Text fw={500}>{cat.name}</Text>
                            {children.map((ch) => (
                              <Group key={ch.id} ml="md" gap="xs">
                                <Text size="sm">↳ {ch.name}</Text>
                                <Badge size="xs" variant="outline">{ch.frequency}</Badge>
                                <ActionIcon variant="subtle" color="red" size="xs" onClick={() => modals.openConfirmModal({
                                  title: 'Delete category',
                                  children: <Text size="sm">Are you sure you want to delete &quot;{ch.name}&quot;? This cannot be undone.</Text>,
                                  labels: { confirm: 'Delete', cancel: 'Cancel' },
                                  confirmProps: { color: 'red' },
                                  onConfirm: async () => { try { await categories.remove(ch.id); load() } catch (e) { console.error('Failed to delete category:', e) } },
                                })}>✕</ActionIcon>
                              </Group>
                            ))}
                          </div>
                        ) : (
                          <Group gap="xs">
                            <Text>{cat.name}</Text>
                            <Badge size="xs" variant="outline">{cat.frequency}</Badge>
                          </Group>
                        )}
                      </Table.Td>
                      <Table.Td w={40}>
                        <ActionIcon variant="subtle" color="red" size="sm" onClick={() => modals.openConfirmModal({
                          title: 'Delete category',
                          children: <Text size="sm">Are you sure you want to delete &quot;{cat.name}&quot;? This cannot be undone.</Text>,
                          labels: { confirm: 'Delete', cancel: 'Cancel' },
                          confirmProps: { color: 'red' },
                          onConfirm: async () => { try { await categories.remove(cat.id); load() } catch (e) { console.error('Failed to delete category:', e) } },
                        })}>✕</ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </Paper>
        )
      })}

      <Modal opened={opened} onClose={close} title="Add Category">
        <Stack>
          <Select label="Location" data={locs.map((l) => ({ value: String(l.id), label: l.name }))} value={form.locationId ? String(form.locationId) : null} onChange={(v) => setForm({ ...form, locationId: Number(v) })} />
          <Select label="Parent Group (optional)" data={parentOptions} value={form.parentId ? String(form.parentId) : ""} onChange={(v) => setForm({ ...form, parentId: v ? Number(v) : null })} clearable />
          <TextInput label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select label="Frequency" data={["weekly", "monthly", "quarterly", "yearly"]} value={form.frequency} onChange={(v) => setForm({ ...form, frequency: v ?? "monthly" })} />
          <TextInput label="Color (hex, optional)" placeholder="#4e79a7" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          <Button onClick={submit} disabled={!form.name || !form.locationId}>Save</Button>
        </Stack>
      </Modal>
    </>
  )
}

// ---------------------------------------------------------------------------
// Salary Tab
// ---------------------------------------------------------------------------

function SalaryTab() {
  const [items, setItems] = useState<SalaryEntry[]>([])
  const [opened, { open, close }] = useDisclosure(false)
  const [form, setForm] = useState({ amount: 0, effectiveFrom: null as Date | null, note: "" })

  const load = useCallback(() => { salary.history().then(setItems) }, [])
  useEffect(load, [load])

  const submit = async () => {
    await salary.create({ amount: form.amount, effectiveFrom: form.effectiveFrom!.toISOString().slice(0, 10), note: form.note || undefined })
    close()
    setForm({ amount: 0, effectiveFrom: null, note: "" })
    load()
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={4}>Salary History</Title>
        <Button size="xs" onClick={open}>+ Add Entry</Button>
      </Group>
      <Table striped withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Effective From</Table.Th>
            <Table.Th>Amount</Table.Th>
            <Table.Th>Currency</Table.Th>
            <Table.Th>Note</Table.Th>
            <Table.Th w={80} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((entry) => (
            <Table.Tr key={entry.id}>
              <Table.Td>{entry.effectiveFrom}</Table.Td>
              <Table.Td fw={600}>{entry.amount.toLocaleString()}</Table.Td>
              <Table.Td>{entry.currency}</Table.Td>
              <Table.Td><Text size="sm" c="dimmed">{entry.note ?? ""}</Text></Table.Td>
              <Table.Td>
                <ActionIcon variant="subtle" color="red" size="sm" onClick={() => modals.openConfirmModal({
                  title: 'Delete salary entry',
                  children: <Text size="sm">Are you sure you want to delete the salary entry from {entry.effectiveFrom}? This cannot be undone.</Text>,
                  labels: { confirm: 'Delete', cancel: 'Cancel' },
                  confirmProps: { color: 'red' },
                  onConfirm: async () => { try { await salary.remove(entry.id); load() } catch (e) { console.error('Failed to delete salary entry:', e) } },
                })}>✕</ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Modal opened={opened} onClose={close} title="Add Salary Entry">
        <Stack>
          <NumberInput label="Monthly Amount (EUR)" value={form.amount} onChange={(v) => setForm({ ...form, amount: Number(v) })} min={0} />
          <DatePickerInput label="Effective From" value={form.effectiveFrom} onChange={(v) => setForm({ ...form, effectiveFrom: v })} clearable />
          <TextInput label="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <Button onClick={submit} disabled={!form.amount || !form.effectiveFrom}>Save</Button>
        </Stack>
      </Modal>
    </>
  )
}

// ---------------------------------------------------------------------------
// Prices Tab
// ---------------------------------------------------------------------------

function PricesTab() {
  const [locs, setLocs] = useState<Location[]>([])
  const [cats, setCats] = useState<ExpenseCategory[]>([])
  const [selectedCat, setSelectedCat] = useState<number | null>(null)
  const [priceItems, setPriceItems] = useState<PriceEntry[]>([])
  const [opened, { open, close }] = useDisclosure(false)
  const [form, setForm] = useState({ amount: 0, effectiveFrom: null as Date | null, note: "" })

  useEffect(() => {
    locations.list().then(setLocs)
    categories.listAll().then(setCats)
  }, [])

  const leafCats = cats.filter((c) => !cats.some((ch) => ch.parentId === c.id))

  useEffect(() => {
    if (selectedCat) prices.history(selectedCat).then(setPriceItems)
    else setPriceItems([])
  }, [selectedCat])

  const catCurrency = selectedCat
    ? locs.find((l) => l.id === cats.find((c) => c.id === selectedCat)?.locationId)?.currency ?? "EUR"
    : "EUR"

  const submit = async () => {
    if (!selectedCat) return
    await prices.create({
      expenseCategoryId: selectedCat,
      amount: form.amount,
      currency: catCurrency,
      effectiveFrom: form.effectiveFrom!.toISOString().slice(0, 10),
      note: form.note || undefined,
    })
    close()
    setForm({ amount: 0, effectiveFrom: null, note: "" })
    prices.history(selectedCat).then(setPriceItems)
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={4}>Price History</Title>
        <Group>
          <Select
            placeholder="Select category"
            data={leafCats.map((c) => ({
              value: String(c.id),
              label: `${c.name} (${locs.find((l) => l.id === c.locationId)?.name ?? ""})`,
            }))}
            value={selectedCat ? String(selectedCat) : null}
            onChange={(v) => setSelectedCat(v ? Number(v) : null)}
            searchable
            clearable
            w={300}
          />
          <Button size="xs" onClick={open} disabled={!selectedCat}>
            + Add Price
          </Button>
        </Group>
      </Group>

      {selectedCat && (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Effective From</Table.Th>
              <Table.Th>Amount</Table.Th>
              <Table.Th>Currency</Table.Th>
              <Table.Th>Note</Table.Th>
              <Table.Th w={80} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {priceItems.map((entry) => (
              <Table.Tr key={entry.id}>
                <Table.Td>{entry.effectiveFrom}</Table.Td>
                <Table.Td fw={600}>{entry.amount.toLocaleString()}</Table.Td>
                <Table.Td>{entry.currency}</Table.Td>
                <Table.Td><Text size="sm" c="dimmed">{entry.note ?? ""}</Text></Table.Td>
                <Table.Td>
                  <ActionIcon variant="subtle" color="red" size="sm" onClick={() => modals.openConfirmModal({
                    title: 'Delete price entry',
                    children: <Text size="sm">Are you sure you want to delete the price entry from {entry.effectiveFrom}? This cannot be undone.</Text>,
                    labels: { confirm: 'Delete', cancel: 'Cancel' },
                    confirmProps: { color: 'red' },
                    onConfirm: async () => { try { await prices.remove(entry.id); if (selectedCat) prices.history(selectedCat).then(setPriceItems) } catch (e) { console.error('Failed to delete price entry:', e) } },
                  })}>✕</ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={opened} onClose={close} title="Add Price Entry">
        <Stack>
          <NumberInput label={`Amount (${catCurrency})`} value={form.amount} onChange={(v) => setForm({ ...form, amount: Number(v) })} min={0} decimalScale={2} />
          <DatePickerInput label="Effective From" value={form.effectiveFrom} onChange={(v) => setForm({ ...form, effectiveFrom: v })} clearable />
          <TextInput label="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <Button onClick={submit} disabled={!form.amount || !form.effectiveFrom}>Save</Button>
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
  const [opened, { open, close }] = useDisclosure(false)
  const [form, setForm] = useState({ rate: 0, effectiveFrom: null as Date | null })
  const [fetching, setFetching] = useState(false)

  const load = useCallback(() => { exchangeRates.history().then(setItems) }, [])
  useEffect(load, [load])

  const submit = async () => {
    await exchangeRates.create({ rate: form.rate, effectiveFrom: form.effectiveFrom!.toISOString().slice(0, 10) })
    close()
    setForm({ rate: 0, effectiveFrom: null })
    load()
  }

  const fetchEcb = async () => {
    setFetching(true)
    try {
      await exchangeRates.fetch()
      load()
    } finally {
      setFetching(false)
    }
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={4}>Exchange Rate History (EUR → PHP)</Title>
        <Group>
          <Button size="xs" variant="light" onClick={fetchEcb} loading={fetching}>
            Fetch ECB Rate
          </Button>
          <Button size="xs" onClick={open}>+ Manual Entry</Button>
        </Group>
      </Group>
      <Table striped withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Effective From</Table.Th>
            <Table.Th>Rate (1 EUR =)</Table.Th>
            <Table.Th>Source</Table.Th>
            <Table.Th w={80} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((entry) => (
            <Table.Tr key={entry.id}>
              <Table.Td>{entry.effectiveFrom}</Table.Td>
              <Table.Td fw={600}>{entry.rate.toFixed(4)} PHP</Table.Td>
              <Table.Td><Badge size="sm" variant="light" color={entry.source === "ecb" ? "blue" : "gray"}>{entry.source}</Badge></Table.Td>
              <Table.Td>
                <ActionIcon variant="subtle" color="red" size="sm" onClick={() => modals.openConfirmModal({
                  title: 'Delete exchange rate',
                  children: <Text size="sm">Are you sure you want to delete the exchange rate from {entry.effectiveFrom}? This cannot be undone.</Text>,
                  labels: { confirm: 'Delete', cancel: 'Cancel' },
                  confirmProps: { color: 'red' },
                  onConfirm: async () => { try { await exchangeRates.remove(entry.id); load() } catch (e) { console.error('Failed to delete exchange rate:', e) } },
                })}>✕</ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Modal opened={opened} onClose={close} title="Add Exchange Rate">
        <Stack>
          <NumberInput label="Rate (1 EUR = X PHP)" value={form.rate} onChange={(v) => setForm({ ...form, rate: Number(v) })} min={0} decimalScale={6} />
          <DatePickerInput label="Effective From" value={form.effectiveFrom} onChange={(v) => setForm({ ...form, effectiveFrom: v })} clearable />
          <Button onClick={submit} disabled={!form.rate || !form.effectiveFrom}>Save</Button>
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
      <Title order={2} mb="lg">
        Settings
      </Title>

      <Tabs defaultValue="locations">
        <Tabs.List mb="md">
          <Tabs.Tab value="locations">Locations</Tabs.Tab>
          <Tabs.Tab value="categories">Categories</Tabs.Tab>
          <Tabs.Tab value="salary">Salary</Tabs.Tab>
          <Tabs.Tab value="prices">Prices</Tabs.Tab>
          <Tabs.Tab value="exchangeRates">Exchange Rates</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="locations"><LocationsTab /></Tabs.Panel>
        <Tabs.Panel value="categories"><CategoriesTab /></Tabs.Panel>
        <Tabs.Panel value="salary"><SalaryTab /></Tabs.Panel>
        <Tabs.Panel value="prices"><PricesTab /></Tabs.Panel>
        <Tabs.Panel value="exchangeRates"><ExchangeRatesTab /></Tabs.Panel>
      </Tabs>
    </Container>
  )
}
