import { useState, useEffect, useCallback, useMemo, forwardRef, type ComponentPropsWithoutRef } from "react"
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  Title,
  Paper,
  Group,
  Text,
  Badge,
  Stack,
  Box,
  Button,
  Menu,
  Tooltip,
  ActionIcon,
  SimpleGrid,
  UnstyledButton,
  NumberInput,
  TextInput,
} from "@mantine/core"
import { DatePickerInput } from "@mantine/dates"
import { modals } from "@mantine/modals"
import { notifications } from "@mantine/notifications"
import { IconPlus, IconArrowsTransferDown, IconArrowLeft, IconMapPin, IconCheck, IconX, IconTrash } from "@tabler/icons-react"

import { locations as locationsApi, categories as categoriesApi, prices as pricesApi } from "../../api/client"
import type { Location, ExpenseCategory, PriceEntry } from "../../api/client"
import { SortableCategoryItem, type CategoryPriceInfo } from "./SortableCategoryItem"
import { CategoryDraftRow, type DraftData } from "./CategoryDraftRow"
import { formatNumber } from "../../utils/format"
import { fromIsoDate, pickerValueToIso } from "../../utils/date.js"
import classes from "../LocationCard.module.css"

function parseFinite(v: number | string): number | undefined {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : undefined
}

type ActiveDraft =
  | null
  | { mode: "add"; locationId: number; parentId: number | null }
  | { mode: "edit"; id: number }

export function CategoriesTab() {
  const [locs, setLocs] = useState<Location[]>([])
  const [items, setItems] = useState<ExpenseCategory[]>([])
  const [activeDraft, setActiveDraft] = useState<ActiveDraft>(null)
  const [draft, setDraft] = useState<DraftData>({ name: "", frequency: "monthly", color: "" })
  const [activeId, setActiveId] = useState<number | null>(null)
  const [reordering, setReordering] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)

  // Price state
  const [allPrices, setAllPrices] = useState<Record<number, PriceEntry[]>>({})
  const [expandedCat, setExpandedCat] = useState<number | null>(null)
  const [addingPriceTo, setAddingPriceTo] = useState<number | null>(null)
  const [priceForm, setPriceForm] = useState({ amount: 0 as number | string, effectiveFrom: "" as string, note: "" })

  const load = useCallback(() => {
    locationsApi.list().then(setLocs)
    categoriesApi.listAll().then(setItems)
  }, [])
  useEffect(load, [load])

  // Load prices when a location is selected
  const loadPricesForLocation = useCallback(async (locationId: number, catList: ExpenseCategory[]) => {
    const locCats = catList.filter((c) => c.locationId === locationId)
    const leaves = locCats.filter((c) => !locCats.some((ch) => ch.parentId === c.id))
    // Also include groups that might have legacy price data
    const withPrices = new Set(leaves.map((c) => c.id))
    const groups = locCats.filter((c) => !withPrices.has(c.id))
    const allToFetch = [...leaves, ...groups]
    const entries = await Promise.all(
      allToFetch.map((c) => pricesApi.history(c.id).then((h) => [c.id, h] as const)),
    )
    setAllPrices(Object.fromEntries(entries))
  }, [])

  useEffect(() => {
    if (selectedLocationId != null && items.length > 0) {
      loadPricesForLocation(selectedLocationId, items)
    }
  }, [selectedLocationId, items, loadPricesForLocation])

  // Reset price state on location change
  useEffect(() => {
    setExpandedCat(null)
    setAddingPriceTo(null)
    setPriceForm({ amount: 0, effectiveFrom: "", note: "" })
  }, [selectedLocationId])

  // ---------------------------------------------------------------------------
  // Draft (add / edit)
  // ---------------------------------------------------------------------------

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
    const siblings = items.filter(
      (c) => c.locationId === activeDraft.locationId && c.parentId === activeDraft.parentId,
    )
    const maxSort = siblings.reduce((m, c) => Math.max(m, c.sortOrder), -1)
    await categoriesApi.create({
      locationId: activeDraft.locationId,
      parentId: activeDraft.parentId,
      name: draft.name,
      frequency: draft.frequency,
      color: draft.color || undefined,
      sortOrder: maxSort + 1,
    })
    resetDraft()
    load()
  }

  const submitEdit = async () => {
    if (activeDraft?.mode !== "edit") return
    await categoriesApi.update(activeDraft.id, {
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
          for (const child of children) await categoriesApi.remove(child.id)
          await categoriesApi.remove(cat.id)
          load()
        } catch (e) {
          console.error("Failed to delete category:", e)
        }
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Move subcategory to different parent
  // ---------------------------------------------------------------------------

  const moveToParent = async (cat: ExpenseCategory, newParentId: number | null) => {
    if (cat.parentId === newParentId) return
    if (reordering) return
    setReordering(true)

    const children = items.filter((c) => c.parentId === cat.id)

    const newSiblings = items.filter(
      (c) => c.locationId === cat.locationId && c.parentId === newParentId && c.id !== cat.id,
    )
    const maxSort = newSiblings.reduce((m, c) => Math.max(m, c.sortOrder), -1)

    const changes: Array<{ id: number; sortOrder: number; parentId: number | null }> = [
      { id: cat.id, sortOrder: maxSort + 1, parentId: newParentId },
    ]

    // If moving a group under another root, promote its children to top level
    if (children.length > 0 && newParentId !== null) {
      const topLevelSiblings = items.filter(
        (c) => c.locationId === cat.locationId && c.parentId === null && c.id !== cat.id,
      )
      let nextSort = topLevelSiblings.reduce((m, c) => Math.max(m, c.sortOrder), -1) + 1
      for (const ch of children) {
        changes.push({ id: ch.id, sortOrder: nextSort++, parentId: null })
      }
    }

    // Recompute old siblings' sort orders to close the gap
    const oldSiblings = items
      .filter((c) => c.locationId === cat.locationId && c.parentId === cat.parentId && c.id !== cat.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    oldSiblings.forEach((c, i) => {
      if (!changes.find((x) => x.id === c.id)) {
        changes.push({ id: c.id, sortOrder: i, parentId: c.parentId })
      }
    })

    // Optimistic
    const optimistic = items.map((c) => {
      const ch = changes.find((x) => x.id === c.id)
      return ch ? { ...c, sortOrder: ch.sortOrder, parentId: ch.parentId } : c
    })
    setItems(optimistic)

    try {
      const fresh = await categoriesApi.reorder(changes)
      setItems(fresh)
    } catch (e) {
      console.error("Move failed:", e)
      load()
    } finally {
      setReordering(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Price management
  // ---------------------------------------------------------------------------

  const toggleExpandPrice = (catId: number) => {
    setExpandedCat((prev) => prev === catId ? null : catId)
    if (addingPriceTo !== catId) {
      setAddingPriceTo(null)
      setPriceForm({ amount: 0, effectiveFrom: "", note: "" })
    }
  }

  const startAddPrice = (catId: number) => {
    setAddingPriceTo(catId)
    setExpandedCat(catId)
    setPriceForm({ amount: 0, effectiveFrom: "", note: "" })
  }

  const cancelAddPrice = () => {
    setAddingPriceTo(null)
    setPriceForm({ amount: 0, effectiveFrom: "", note: "" })
  }

  const submitAddPrice = async () => {
    if (!addingPriceTo) return
    const amount = parseFinite(priceForm.amount)
    if (amount == null) return
    const catId = addingPriceTo
    const currency = locs.find((l) => l.id === items.find((c) => c.id === catId)?.locationId)?.currency ?? "EUR"
    try {
      await pricesApi.create({
        expenseCategoryId: catId,
        amount,
        currency,
        effectiveFrom: priceForm.effectiveFrom,
        note: priceForm.note || undefined,
      })
      notifications.show({ title: "Success", message: "Price entry created", color: "teal", icon: <IconCheck size={16} /> })
      setAddingPriceTo(null)
      setPriceForm({ amount: 0, effectiveFrom: "", note: "" })
      const updated = await pricesApi.history(catId)
      setAllPrices((prev) => ({ ...prev, [catId]: updated }))
    } catch (e) {
      console.error("Failed to create price entry:", e)
      notifications.show({ title: "Error", message: "Failed to create price entry", color: "red", icon: <IconX size={16} /> })
    }
  }

  const confirmDeletePrice = (entry: PriceEntry) => {
    modals.openConfirmModal({
      title: "Delete price entry",
      children: <Text size="sm">Delete the price entry from {entry.effectiveFrom}? This cannot be undone.</Text>,
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await pricesApi.remove(entry.id)
          notifications.show({ title: "Success", message: "Price entry deleted", color: "teal", icon: <IconCheck size={16} /> })
          const updated = await pricesApi.history(entry.expenseCategoryId)
          setAllPrices((prev) => ({ ...prev, [entry.expenseCategoryId]: updated }))
        } catch (e) {
          console.error("Failed to delete price entry:", e)
          notifications.show({ title: "Error", message: "Failed to delete price entry", color: "red", icon: <IconX size={16} /> })
        }
      },
    })
  }

  const getPriceInfo = (catId: number): CategoryPriceInfo => {
    const history = allPrices[catId] ?? []
    return { latest: history[0] ?? null, count: history.length }
  }

  // ---------------------------------------------------------------------------
  // Drag and drop (same-level reorder only)
  // ---------------------------------------------------------------------------

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const activeItem = useMemo(
    () => (activeId != null ? items.find((c) => c.id === activeId) ?? null : null),
    [activeId, items],
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number)
    setExpandedCat(null)
    setAddingPriceTo(null)
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    if (reordering) return // prevent concurrent reorders

    const draggedId = active.id as number
    const overId = over.id as number

    const dragged = items.find((c) => c.id === draggedId)
    const target = items.find((c) => c.id === overId)
    if (!dragged || !target) return

    // Same-level only: both must share the same parentId and locationId
    if (dragged.locationId !== target.locationId) return
    if (dragged.parentId !== target.parentId) return

    const siblings = items
      .filter((c) => c.locationId === dragged.locationId && c.parentId === dragged.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)

    const oldIndex = siblings.findIndex((c) => c.id === draggedId)
    const newIndex = siblings.findIndex((c) => c.id === overId)
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

    const reordered = arrayMove(siblings, oldIndex, newIndex)
    const changes = reordered.map((c, i) => ({
      id: c.id,
      sortOrder: i,
      parentId: c.parentId,
    }))

    // Optimistic update
    const optimistic = items.map((c) => {
      const ch = changes.find((x) => x.id === c.id)
      return ch ? { ...c, sortOrder: ch.sortOrder } : c
    })
    setItems(optimistic)
    setReordering(true)

    try {
      const fresh = await categoriesApi.reorder(changes)
      setItems(fresh)
    } catch (e) {
      console.error("Reorder failed:", e)
      load()
    } finally {
      setReordering(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const selectedLoc = selectedLocationId != null ? locs.find((l) => l.id === selectedLocationId) : null

  // When no location selected, show location picker grid
  if (!selectedLoc) {
    return (
      <>
        <Title order={4} mb="md">Categories &amp; Prices</Title>
        <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }} spacing="md">
          {locs.map((loc) => {
            const catCount = items.filter((c) => c.locationId === loc.id).length
            return (
              <UnstyledButton
                key={loc.id}
                onClick={() => setSelectedLocationId(loc.id)}
              >
                <Paper withBorder p="xl" radius="md" className={classes.card}>
                  <Stack align="center" gap="sm">
                    <IconMapPin size={32} stroke={1.5} color="var(--mantine-color-blue-6)" />
                    <Text fw={600} size="lg" ta="center">{loc.name}</Text>
                    <Badge size="sm" variant="light">{loc.currency}</Badge>
                    <Text size="sm" c="dimmed">{catCount} {catCount === 1 ? "category" : "categories"}</Text>
                  </Stack>
                </Paper>
              </UnstyledButton>
            )
          })}
        </SimpleGrid>
      </>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <Group gap="xs" mb="md">
        <ActionIcon variant="subtle" size="lg" onClick={() => setSelectedLocationId(null)} aria-label="Back to locations">
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Title order={4}>{selectedLoc.name}</Title>
        <Badge size="sm" variant="light">{selectedLoc.currency}</Badge>
      </Group>

      <LocationSection
        location={selectedLoc}
        items={items}
        activeDraft={activeDraft}
        draft={draft}
        onDraftChange={setDraft}
        onStartAdd={startAdd}
        onStartEdit={startEdit}
        onSubmitAdd={submitAdd}
        onSubmitEdit={submitEdit}
        onResetDraft={resetDraft}
        onDelete={confirmDelete}
        onMoveToParent={moveToParent}
        allPrices={allPrices}
        getPriceInfo={getPriceInfo}
        expandedCat={expandedCat}
        onToggleExpandPrice={toggleExpandPrice}
        addingPriceTo={addingPriceTo}
        priceForm={priceForm}
        onPriceFormChange={setPriceForm}
        onStartAddPrice={startAddPrice}
        onCancelAddPrice={cancelAddPrice}
        onSubmitAddPrice={submitAddPrice}
        onDeletePrice={confirmDeletePrice}
      />

      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
        {activeItem ? (
          <SortableCategoryItem
            category={activeItem}
            isChild={activeItem.parentId !== null}
            isGroup={items.some((c) => c.parentId === activeItem.id)}
            isDragOverlay
            onStartEdit={() => {}}
            onDelete={() => {}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// ---------------------------------------------------------------------------
// Location section (one card per location)
// ---------------------------------------------------------------------------

interface LocationSectionProps {
  location: Location
  items: ExpenseCategory[]
  activeDraft: ActiveDraft
  draft: DraftData
  onDraftChange: (d: DraftData) => void
  onStartAdd: (locationId: number, parentId: number | null) => void
  onStartEdit: (cat: ExpenseCategory) => void
  onSubmitAdd: () => void
  onSubmitEdit: () => void
  onResetDraft: () => void
  onDelete: (cat: ExpenseCategory) => void
  onMoveToParent: (cat: ExpenseCategory, newParentId: number | null) => void
  // Price props
  allPrices: Record<number, PriceEntry[]>
  getPriceInfo: (catId: number) => CategoryPriceInfo
  expandedCat: number | null
  onToggleExpandPrice: (catId: number) => void
  addingPriceTo: number | null
  priceForm: { amount: number | string; effectiveFrom: string; note: string }
  onPriceFormChange: (form: { amount: number | string; effectiveFrom: string; note: string }) => void
  onStartAddPrice: (catId: number) => void
  onCancelAddPrice: () => void
  onSubmitAddPrice: () => void
  onDeletePrice: (entry: PriceEntry) => void
}

function LocationSection({
  location: loc,
  items,
  activeDraft,
  draft,
  onDraftChange,
  onStartAdd,
  onStartEdit,
  onSubmitAdd,
  onSubmitEdit,
  onResetDraft,
  onDelete,
  onMoveToParent,
  allPrices,
  getPriceInfo,
  expandedCat,
  onToggleExpandPrice,
  addingPriceTo,
  priceForm,
  onPriceFormChange,
  onStartAddPrice,
  onCancelAddPrice,
  onSubmitAddPrice,
  onDeletePrice,
}: LocationSectionProps) {
  const locCats = items.filter((c) => c.locationId === loc.id)
  const roots = locCats
    .filter((c) => c.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const rootIds = roots.map((r) => r.id)

  // Build move targets for subcategories: all roots in this location
  const moveTargets = (cat: ExpenseCategory) => {
    const targets: Array<{ label: string; parentId: number | null }> = []
    // Option to promote to root
    if (cat.parentId !== null) {
      targets.push({ label: "⬆ Move to top level", parentId: null })
    }
    // Option to move under each root (except current parent and self)
    for (const root of roots) {
      if (root.id === cat.id) continue
      if (root.id === cat.parentId) continue
      targets.push({ label: root.name, parentId: root.id })
    }
    return targets
  }

  return (
    <>
      <SortableContext items={rootIds} strategy={verticalListSortingStrategy}>
        <Stack gap={0}>
          {roots.map((root) => {
            const children = locCats
              .filter((c) => c.parentId === root.id)
              .sort((a, b) => a.sortOrder - b.sortOrder)
            const isGroup = children.length > 0
            const childIds = children.map((c) => c.id)

            // Editing root
            if (activeDraft?.mode === "edit" && activeDraft.id === root.id) {
              return (
                <Box key={root.id} mb={isGroup ? "xs" : 0}>
                  <CategoryDraftRow
                    draft={draft}
                    onChange={onDraftChange}
                    onSubmit={onSubmitEdit}
                    onCancel={onResetDraft}
                  />
                  <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
                    {children.map((ch) => (
                      <Box key={ch.id}>
                        <SortableCategoryItem
                          category={ch}
                          isChild
                          isGroup={false}
                          priceInfo={getPriceInfo(ch.id)}
                          currency={loc.currency}
                          isExpanded={expandedCat === ch.id}
                          onToggleExpand={() => onToggleExpandPrice(ch.id)}
                          onStartEdit={() => onStartEdit(ch)}
                          onDelete={() => onDelete(ch)}
                          moveMenu={
                            <MoveMenu
                              targets={moveTargets(ch)}
                              onMove={(parentId) => onMoveToParent(ch, parentId)}
                            />
                          }
                        />
                        <PriceExpansion
                          cat={ch}
                          isChild
                          currency={loc.currency}
                          allPrices={allPrices}
                          expandedCat={expandedCat}
                          addingPriceTo={addingPriceTo}
                          priceForm={priceForm}
                          onPriceFormChange={onPriceFormChange}
                          onStartAddPrice={onStartAddPrice}
                          onCancelAddPrice={onCancelAddPrice}
                          onSubmitAddPrice={onSubmitAddPrice}
                          onDeletePrice={onDeletePrice}
                        />
                      </Box>
                    ))}
                  </SortableContext>
                </Box>
              )
            }

            return (
              <Box key={root.id} mb={isGroup ? "xs" : 0}>
                <SortableCategoryItem
                  category={root}
                  isChild={false}
                  isGroup={isGroup}
                  priceInfo={!isGroup ? getPriceInfo(root.id) : undefined}
                  currency={loc.currency}
                  isExpanded={!isGroup ? expandedCat === root.id : undefined}
                  onToggleExpand={!isGroup ? () => onToggleExpandPrice(root.id) : undefined}
                  onStartAdd={() => onStartAdd(loc.id, root.id)}
                  onStartEdit={() => onStartEdit(root)}
                  onDelete={() => onDelete(root)}
                  moveMenu={
                    <MoveMenu
                      targets={moveTargets(root)}
                      onMove={(parentId) => onMoveToParent(root, parentId)}
                    />
                  }
                />
                {!isGroup && (
                  <PriceExpansion
                    cat={root}
                    isChild={false}
                    currency={loc.currency}
                    allPrices={allPrices}
                    expandedCat={expandedCat}
                    addingPriceTo={addingPriceTo}
                    priceForm={priceForm}
                    onPriceFormChange={onPriceFormChange}
                    onStartAddPrice={onStartAddPrice}
                    onCancelAddPrice={onCancelAddPrice}
                    onSubmitAddPrice={onSubmitAddPrice}
                    onDeletePrice={onDeletePrice}
                  />
                )}

                <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
                  {children.map((ch) =>
                    activeDraft?.mode === "edit" && activeDraft.id === ch.id ? (
                      <CategoryDraftRow
                        key={ch.id}
                        draft={draft}
                        onChange={onDraftChange}
                        onSubmit={onSubmitEdit}
                        onCancel={onResetDraft}
                        indent
                      />
                    ) : (
                      <Box key={ch.id}>
                        <SortableCategoryItem
                          category={ch}
                          isChild
                          isGroup={false}
                          priceInfo={getPriceInfo(ch.id)}
                          currency={loc.currency}
                          isExpanded={expandedCat === ch.id}
                          onToggleExpand={() => onToggleExpandPrice(ch.id)}
                          onStartEdit={() => onStartEdit(ch)}
                          onDelete={() => onDelete(ch)}
                          moveMenu={
                            <MoveMenu
                              targets={moveTargets(ch)}
                              onMove={(parentId) => onMoveToParent(ch, parentId)}
                            />
                          }
                        />
                        <PriceExpansion
                          cat={ch}
                          isChild
                          currency={loc.currency}
                          allPrices={allPrices}
                          expandedCat={expandedCat}
                          addingPriceTo={addingPriceTo}
                          priceForm={priceForm}
                          onPriceFormChange={onPriceFormChange}
                          onStartAddPrice={onStartAddPrice}
                          onCancelAddPrice={onCancelAddPrice}
                          onSubmitAddPrice={onSubmitAddPrice}
                          onDeletePrice={onDeletePrice}
                        />
                      </Box>
                    ),
                  )}
                </SortableContext>

                {activeDraft?.mode === "add" && activeDraft.parentId === root.id ? (
                  <CategoryDraftRow
                    draft={draft}
                    onChange={onDraftChange}
                    onSubmit={onSubmitAdd}
                    onCancel={onResetDraft}
                    indent
                  />
                ) : isGroup ? (
                  <Group pl={28} py={4}>
                    <Button
                      variant="subtle"
                      size="compact-sm"
                      c="dimmed"
                      leftSection={<IconPlus size={12} />}
                      onClick={() => onStartAdd(loc.id, root.id)}
                    >
                      Add sub-category
                    </Button>
                  </Group>
                ) : null}
              </Box>
            )
          })}
        </Stack>
      </SortableContext>

      {activeDraft?.mode === "add" && activeDraft.locationId === loc.id && activeDraft.parentId === null ? (
        <Box mt="xs">
          <CategoryDraftRow
            draft={draft}
            onChange={onDraftChange}
            onSubmit={onSubmitAdd}
            onCancel={onResetDraft}
          />
        </Box>
      ) : (
        <Button
          variant="subtle"
          size="compact-sm"
          mt="xs"
          c="dimmed"
          leftSection={<IconPlus size={12} />}
          onClick={() => onStartAdd(loc.id, null)}
        >
          Add category
        </Button>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Inline price expansion (rendered as sibling, outside draggable node)
// ---------------------------------------------------------------------------

interface PriceExpansionProps {
  cat: ExpenseCategory
  isChild: boolean
  currency: string
  allPrices: Record<number, PriceEntry[]>
  expandedCat: number | null
  addingPriceTo: number | null
  priceForm: { amount: number | string; effectiveFrom: string; note: string }
  onPriceFormChange: (form: { amount: number | string; effectiveFrom: string; note: string }) => void
  onStartAddPrice: (catId: number) => void
  onCancelAddPrice: () => void
  onSubmitAddPrice: () => void
  onDeletePrice: (entry: PriceEntry) => void
}

function PriceExpansion({
  cat,
  isChild,
  currency,
  allPrices,
  expandedCat,
  addingPriceTo,
  priceForm,
  onPriceFormChange,
  onStartAddPrice,
  onCancelAddPrice,
  onSubmitAddPrice,
  onDeletePrice,
}: PriceExpansionProps) {
  if (expandedCat !== cat.id) return null

  const history = allPrices[cat.id] ?? []
  const basePl = isChild ? 56 : 28

  return (
    <Box pl={basePl} pb="xs">
      {history.length > 0 ? (
        <Stack gap={0}>
          {history.map((entry) => (
            <Group key={entry.id} gap="sm" py={4} wrap="nowrap">
              <Text size="sm" c="dimmed" w={100}>{entry.effectiveFrom}</Text>
              <Text size="sm" fw={500} style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatNumber(entry.amount, 2)} {entry.currency}
              </Text>
              <Text size="sm" c="dimmed" style={{ flex: 1 }}>{entry.note ?? ""}</Text>
              <Tooltip label="Delete" withArrow>
                <ActionIcon variant="subtle" color="red" size="md" aria-label="Delete price entry" onClick={() => onDeletePrice(entry)}>
                  <IconTrash size={14} stroke={1.5} />
                </ActionIcon>
              </Tooltip>
            </Group>
          ))}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed" py={4}>No price entries yet</Text>
      )}

      {addingPriceTo === cat.id ? (
        <Group gap="sm" py={8} wrap="wrap" mt="xs">
          <NumberInput
            placeholder={`Amount (${currency})`}
            size="sm"
            value={priceForm.amount}
            onChange={(v) => onPriceFormChange({ ...priceForm, amount: v })}
            min={0}
            decimalScale={2}
            style={{ flex: 1, minWidth: 120 }}
            autoFocus
            withAsterisk
          />
          <DatePickerInput
            placeholder="Effective from"
            size="sm"
            value={fromIsoDate(priceForm.effectiveFrom)}
            onChange={(v) => onPriceFormChange({ ...priceForm, effectiveFrom: v ? pickerValueToIso(v) : "" })}
            w={160}
            withAsterisk
          />
          <TextInput
            placeholder="Note (optional)"
            size="sm"
            value={priceForm.note}
            onChange={(e) => onPriceFormChange({ ...priceForm, note: e.target.value })}
            style={{ flex: 1, minWidth: 120 }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && parseFinite(priceForm.amount) != null && priceForm.effectiveFrom) onSubmitAddPrice()
              if (e.key === "Escape") onCancelAddPrice()
            }}
          />
          <Group gap={4} wrap="nowrap">
            <ActionIcon size="md" variant="filled" color="blue" onClick={onSubmitAddPrice} disabled={parseFinite(priceForm.amount) == null || !priceForm.effectiveFrom} aria-label="Save">
              <IconCheck size={16} />
            </ActionIcon>
            <ActionIcon size="md" variant="subtle" color="gray" onClick={onCancelAddPrice} aria-label="Cancel">
              <IconX size={16} />
            </ActionIcon>
          </Group>
        </Group>
      ) : (
        <Button variant="subtle" size="compact-sm" c="dimmed" mt="xs" leftSection={<IconPlus size={12} />} onClick={() => onStartAddPrice(cat.id)}>
          Add price
        </Button>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Move-to menu for subcategories
// ---------------------------------------------------------------------------

interface MoveMenuProps {
  targets: Array<{ label: string; parentId: number | null }>
  onMove: (parentId: number | null) => void
}

function MoveMenu({ targets, onMove }: MoveMenuProps) {
  if (targets.length === 0) return null
  return (
    <Menu shadow="md" width={200} position="bottom-end">
      <Menu.Target>
        <ActionIconWrapper label="Move to…" />
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Move to</Menu.Label>
        {targets.map((t) => (
          <Menu.Item key={String(t.parentId)} onClick={() => onMove(t.parentId)}>
            {t.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  )
}

const ActionIconWrapper = forwardRef<HTMLButtonElement, { label: string } & ComponentPropsWithoutRef<"button">>(
  ({ label, ...props }, ref) => (
    <Tooltip label={label} withArrow>
      <ActionIcon ref={ref} variant="subtle" size="sm" c="dimmed" {...props}>
        <IconArrowsTransferDown size={14} />
      </ActionIcon>
    </Tooltip>
  ),
)
ActionIconWrapper.displayName = "ActionIconWrapper"
