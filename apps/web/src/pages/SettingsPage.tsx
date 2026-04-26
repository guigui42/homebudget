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
  Box,
  Tooltip,
  ColorInput,
  ColorSwatch,
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

type ActiveDraft =
  | null
  | { mode: "add"; locationId: number; parentId: number | null }
  | { mode: "edit"; id: number }

function CategoriesTab() {
  const [locs, setLocs] = useState<Location[]>([])
  const [items, setItems] = useState<ExpenseCategory[]>([])
  const [activeDraft, setActiveDraft] = useState<ActiveDraft>(null)
  const [draft, setDraft] = useState({ name: "", frequency: "monthly", color: "" })

  const load = useCallback(() => {
    locations.list().then(setLocs)
    categories.listAll().then(setItems)
  }, [])
  useEffect(load, [load])

  const resetDraft = () => {
    setActiveDraft(null)
    setDraft({ name: "", frequency: "monthly", color: "" })
  }

  const startAdd = (locationId: number, parentId: number | null) => {
    setActiveDraft({ mode: "add", locationId, parentId })
    setDraft({ name: "", frequency: "monthly", color: "" })
  }

  const startEdit = (cat: ExpenseCategory) => {
    setActiveDraft({ mode: "edit", id: cat.id })
    setDraft({ name: cat.name, frequency: cat.frequency, color: cat.color ?? "" })
  }

  const submitAdd = async () => {
    if (activeDraft?.mode !== "add" || !draft.name) return
    await categories.create({
      locationId: activeDraft.locationId,
      parentId: activeDraft.parentId,
      name: draft.name,
      frequency: draft.frequency,
      color: draft.color || undefined,
    })
    resetDraft()
    load()
  }

  const submitEdit = async () => {
    if (activeDraft?.mode !== "edit") return
    await categories.update(activeDraft.id, {
      name: draft.name,
      frequency: draft.frequency,
      color: draft.color || null,
    })
    resetDraft()
    load()
  }

  const confirmDelete = (cat: ExpenseCategory) => {
    const children = items.filter((c) => c.parentId === cat.id)
    const msg = children.length
      ? `Delete "${cat.name}" and its ${children.length} sub-categor${children.length === 1 ? "y" : "ies"}? This cannot be undone.`
      : `Delete "${cat.name}"? This cannot be undone.`
    modals.openConfirmModal({
      title: "Delete category",
      children: <Text size="sm">{msg}</Text>,
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          for (const child of children) await categories.remove(child.id)
          await categories.remove(cat.id)
          load()
        } catch (e) {
          console.error("Failed to delete category:", e)
        }
      },
    })
  }

  const DraftRow = ({ onSubmit, onCancel, indent }: { onSubmit: () => void; onCancel: () => void; indent?: boolean }) => (
    <Group gap="sm" py={8} pl={indent ? 28 : 0} wrap="wrap">
      {indent && <Text c="dimmed">↳</Text>}
      <TextInput
        placeholder="Category name"
        size="sm"
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        style={{ flex: 1, minWidth: 180 }}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.name) onSubmit()
          if (e.key === "Escape") onCancel()
        }}
      />
      <Select
        size="sm"
        data={["weekly", "monthly", "quarterly", "yearly"]}
        value={draft.frequency}
        onChange={(v) => setDraft({ ...draft, frequency: v ?? "monthly" })}
        w={120}
        allowDeselect={false}
      />
      <ColorInput
        size="sm"
        placeholder="Color"
        value={draft.color}
        onChange={(v) => setDraft({ ...draft, color: v })}
        w={140}
        swatches={["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac"]}
      />
      <Group gap={4} wrap="nowrap">
        <ActionIcon size="md" variant="filled" color="blue" onClick={onSubmit} disabled={!draft.name}>
          ✓
        </ActionIcon>
        <ActionIcon size="md" variant="subtle" color="gray" onClick={onCancel}>
          ✕
        </ActionIcon>
      </Group>
    </Group>
  )

  return (
    <>
      <Title order={4} mb="md">Expense Categories</Title>
      {locs.map((loc) => {
        const locCats = items.filter((c) => c.locationId === loc.id)
        const roots = locCats.filter((c) => c.parentId === null)

        return (
          <Paper key={loc.id} withBorder p="md" mb="md">
            <Group gap="xs" mb="sm">
              <Text fw={600} size="lg">{loc.name}</Text>
              <Badge size="sm" variant="light">{loc.currency}</Badge>
            </Group>

            <Stack gap={0}>
              {roots.map((root) => {
                const children = locCats.filter((c) => c.parentId === root.id)
                const isGroup = children.length > 0

                if (activeDraft?.mode === "edit" && activeDraft.id === root.id) {
                  return (
                    <Box key={root.id} mb={isGroup ? "xs" : 0}>
                      <DraftRow onSubmit={submitEdit} onCancel={resetDraft} />
                      {children.map((ch) => (
                        <Group key={ch.id} gap="sm" py={6} pl={28} wrap="nowrap">
                          <Text c="dimmed">↳</Text>
                          {ch.color && <ColorSwatch size={12} color={ch.color} />}
                          <Text style={{ flex: 1 }}>{ch.name}</Text>
                          <Badge size="sm" variant="outline">{ch.frequency}</Badge>
                        </Group>
                      ))}
                    </Box>
                  )
                }

                return (
                  <Box key={root.id} mb={isGroup ? "xs" : 0}>
                    {/* Root category row */}
                    <Group gap="sm" py={6} wrap="nowrap">
                      {root.color && <ColorSwatch size={14} color={root.color} />}
                      <Text fw={isGroup ? 600 : 400} style={{ flex: 1 }}>{root.name}</Text>
                      <Badge size="sm" variant="outline">{root.frequency}</Badge>
                      <Tooltip label="Add sub-category" withArrow>
                        <ActionIcon variant="subtle" size="sm" c="dimmed" onClick={() => startAdd(loc.id, root.id)}>+</ActionIcon>
                      </Tooltip>
                      <Tooltip label="Edit" withArrow>
                        <ActionIcon variant="subtle" size="sm" onClick={() => startEdit(root)}>✎</ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete" withArrow>
                        <ActionIcon variant="subtle" color="red" size="sm" onClick={() => confirmDelete(root)}>✕</ActionIcon>
                      </Tooltip>
                    </Group>

                    {/* Children */}
                    {children.map((ch) =>
                      activeDraft?.mode === "edit" && activeDraft.id === ch.id ? (
                        <DraftRow key={ch.id} onSubmit={submitEdit} onCancel={resetDraft} indent />
                      ) : (
                        <Group key={ch.id} gap="sm" py={6} pl={28} wrap="nowrap">
                          <Text c="dimmed">↳</Text>
                          {ch.color && <ColorSwatch size={12} color={ch.color} />}
                          <Text style={{ flex: 1 }}>{ch.name}</Text>
                          <Badge size="sm" variant="outline">{ch.frequency}</Badge>
                          <Tooltip label="Edit" withArrow>
                            <ActionIcon variant="subtle" size="sm" onClick={() => startEdit(ch)}>✎</ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete" withArrow>
                            <ActionIcon variant="subtle" color="red" size="sm" onClick={() => confirmDelete(ch)}>✕</ActionIcon>
                          </Tooltip>
                        </Group>
                      ),
                    )}

                    {/* Inline add for sub-category */}
                    {activeDraft?.mode === "add" && activeDraft.parentId === root.id ? (
                      <DraftRow onSubmit={submitAdd} onCancel={resetDraft} indent />
                    ) : isGroup ? (
                      <Group pl={28} py={4}>
                        <Button variant="subtle" size="compact-sm" c="dimmed" onClick={() => startAdd(loc.id, root.id)}>
                          + Add sub-category
                        </Button>
                      </Group>
                    ) : null}
                  </Box>
                )
              })}
            </Stack>

            {/* Add root category at location level */}
            {activeDraft?.mode === "add" && activeDraft.locationId === loc.id && activeDraft.parentId === null ? (
              <Box mt="xs">
                <DraftRow onSubmit={submitAdd} onCancel={resetDraft} />
              </Box>
            ) : (
              <Button variant="subtle" size="compact-sm" mt="xs" c="dimmed" onClick={() => startAdd(loc.id, null)}>
                + Add category
              </Button>
            )}
          </Paper>
        )
      })}
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
  const [allPrices, setAllPrices] = useState<Record<number, PriceEntry[]>>({})
  const [expandedCat, setExpandedCat] = useState<number | null>(null)
  const [addingTo, setAddingTo] = useState<number | null>(null)
  const [addForm, setAddForm] = useState({ amount: 0, effectiveFrom: null as Date | null, note: "" })

  const loadPrices = useCallback(async (catList: ExpenseCategory[]) => {
    const leaves = catList.filter((c) => !catList.some((ch) => ch.parentId === c.id))
    const entries = await Promise.all(leaves.map((c) => prices.history(c.id).then((h) => [c.id, h] as const)))
    setAllPrices(Object.fromEntries(entries))
  }, [])

  const load = useCallback(async () => {
    const [l, c] = await Promise.all([locations.list(), categories.listAll()])
    setLocs(l)
    setCats(c)
    await loadPrices(c)
  }, [loadPrices])

  useEffect(() => { load() }, [load])

  const toggleExpand = (catId: number) => {
    setExpandedCat((prev) => prev === catId ? null : catId)
    if (addingTo !== catId) setAddingTo(null)
  }

  const startAdd = (catId: number) => {
    setAddingTo(catId)
    setExpandedCat(catId)
    setAddForm({ amount: 0, effectiveFrom: null, note: "" })
  }

  const cancelAdd = () => {
    setAddingTo(null)
    setAddForm({ amount: 0, effectiveFrom: null, note: "" })
  }

  const submitAdd = async () => {
    if (!addingTo) return
    const catId = addingTo
    const currency = locs.find((l) => l.id === cats.find((c) => c.id === catId)?.locationId)?.currency ?? "EUR"
    await prices.create({
      expenseCategoryId: catId,
      amount: addForm.amount,
      currency,
      effectiveFrom: addForm.effectiveFrom!.toISOString().slice(0, 10),
      note: addForm.note || undefined,
    })
    setAddingTo(null)
    setAddForm({ amount: 0, effectiveFrom: null, note: "" })
    const updated = await prices.history(catId)
    setAllPrices((prev) => ({ ...prev, [catId]: updated }))
  }

  const confirmDeletePrice = (entry: PriceEntry) => {
    modals.openConfirmModal({
      title: "Delete price entry",
      children: <Text size="sm">Delete the price entry from {entry.effectiveFrom}? This cannot be undone.</Text>,
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await prices.remove(entry.id)
          const updated = await prices.history(entry.expenseCategoryId)
          setAllPrices((prev) => ({ ...prev, [entry.expenseCategoryId]: updated }))
        } catch (e) {
          console.error("Failed to delete price entry:", e)
        }
      },
    })
  }

  const LeafRow = ({ cat, indent }: { cat: ExpenseCategory; indent?: boolean }) => {
    const history = allPrices[cat.id] ?? []
    const latest = history[0]
    const isExpanded = expandedCat === cat.id
    const currency = locs.find((l) => l.id === cat.locationId)?.currency ?? "EUR"

    return (
      <Box>
        <Group
          gap="sm" py={6} pl={indent ? 28 : 0} wrap="nowrap"
          style={{ cursor: "pointer" }}
          onClick={() => toggleExpand(cat.id)}
        >
          {indent && <Text c="dimmed">↳</Text>}
          {cat.color && <ColorSwatch size={12} color={cat.color} />}
          <Text style={{ flex: 1 }}>{cat.name}</Text>
          {latest ? (
            <>
              <Text fw={600}>{latest.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {latest.currency}</Text>
              <Text size="sm" c="dimmed">since {latest.effectiveFrom}</Text>
            </>
          ) : (
            <Text size="sm" c="dimmed" fs="italic">no price set</Text>
          )}
          <Tooltip label="Add price" withArrow>
            <ActionIcon variant="subtle" size="sm" onClick={(e) => { e.stopPropagation(); startAdd(cat.id) }}>+</ActionIcon>
          </Tooltip>
          <Text size="xs" c="dimmed">{isExpanded ? "▾" : "▸"}</Text>
        </Group>

        {isExpanded && (
          <Box pl={indent ? 56 : 28} pb="xs">
            {history.length > 0 ? (
              <Stack gap={0}>
                {history.map((entry) => (
                  <Group key={entry.id} gap="sm" py={4} wrap="nowrap">
                    <Text size="sm" c="dimmed" w={100}>{entry.effectiveFrom}</Text>
                    <Text size="sm" fw={500}>{entry.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {entry.currency}</Text>
                    <Text size="sm" c="dimmed" style={{ flex: 1 }}>{entry.note ?? ""}</Text>
                    <ActionIcon variant="subtle" color="red" size="sm" onClick={() => confirmDeletePrice(entry)}>✕</ActionIcon>
                  </Group>
                ))}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed" py={4}>No price entries yet</Text>
            )}

            {addingTo === cat.id ? (
              <Group gap="sm" py={8} wrap="wrap" mt="xs">
                <NumberInput
                  placeholder={`Amount (${currency})`}
                  size="sm"
                  value={addForm.amount || ""}
                  onChange={(v) => setAddForm({ ...addForm, amount: Number(v) })}
                  min={0}
                  decimalScale={2}
                  style={{ flex: 1, minWidth: 120 }}
                  autoFocus
                />
                <DatePickerInput
                  placeholder="Effective from"
                  size="sm"
                  value={addForm.effectiveFrom}
                  onChange={(v) => setAddForm({ ...addForm, effectiveFrom: v })}
                  w={160}
                />
                <TextInput
                  placeholder="Note (optional)"
                  size="sm"
                  value={addForm.note}
                  onChange={(e) => setAddForm({ ...addForm, note: e.target.value })}
                  style={{ flex: 1, minWidth: 120 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && addForm.amount && addForm.effectiveFrom) submitAdd()
                    if (e.key === "Escape") cancelAdd()
                  }}
                />
                <Group gap={4} wrap="nowrap">
                  <ActionIcon size="md" variant="filled" color="blue" onClick={submitAdd} disabled={!addForm.amount || !addForm.effectiveFrom}>✓</ActionIcon>
                  <ActionIcon size="md" variant="subtle" color="gray" onClick={cancelAdd}>✕</ActionIcon>
                </Group>
              </Group>
            ) : (
              <Button variant="subtle" size="compact-sm" c="dimmed" mt="xs" onClick={() => startAdd(cat.id)}>
                + Add price
              </Button>
            )}
          </Box>
        )}
      </Box>
    )
  }

  return (
    <>
      <Title order={4} mb="md">Price History</Title>
      {locs.map((loc) => {
        const locCats = cats.filter((c) => c.locationId === loc.id)
        const roots = locCats.filter((c) => c.parentId === null)

        return (
          <Paper key={loc.id} withBorder p="md" mb="md">
            <Group gap="xs" mb="sm">
              <Text fw={600} size="lg">{loc.name}</Text>
              <Badge size="sm" variant="light">{loc.currency}</Badge>
            </Group>

            <Stack gap={0}>
              {roots.map((root) => {
                const children = locCats.filter((c) => c.parentId === root.id)
                const isGroup = children.length > 0
                const isLeaf = !cats.some((ch) => ch.parentId === root.id)

                if (isGroup) {
                  return (
                    <Box key={root.id} mb="xs">
                      <Group gap="sm" py={4}>
                        {root.color && <ColorSwatch size={14} color={root.color} />}
                        <Text fw={600}>{root.name}</Text>
                      </Group>
                      {children.map((ch) => (
                        <LeafRow key={ch.id} cat={ch} indent />
                      ))}
                    </Box>
                  )
                }

                if (isLeaf) {
                  return <LeafRow key={root.id} cat={root} />
                }

                return null
              })}
            </Stack>
          </Paper>
        )
      })}
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
