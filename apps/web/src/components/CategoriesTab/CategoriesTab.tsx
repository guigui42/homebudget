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
} from "@mantine/core"
import { modals } from "@mantine/modals"
import { IconPlus, IconArrowsTransferDown, IconArrowLeft, IconMapPin } from "@tabler/icons-react"

import { locations as locationsApi, categories as categoriesApi } from "../../api/client"
import type { Location, ExpenseCategory } from "../../api/client"
import { SortableCategoryItem } from "./SortableCategoryItem"
import { CategoryDraftRow, type DraftData } from "./CategoryDraftRow"
import classes from "../LocationCard.module.css"

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

  const load = useCallback(() => {
    locationsApi.list().then(setLocs)
    categoriesApi.listAll().then(setItems)
  }, [])
  useEffect(load, [load])

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
        <Title order={4} mb="md">Expense Categories</Title>
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
                      <SortableCategoryItem
                        key={ch.id}
                        category={ch}
                        isChild
                        isGroup={false}
                        onStartEdit={() => onStartEdit(ch)}
                        onDelete={() => onDelete(ch)}
                        moveMenu={
                          <MoveMenu
                            targets={moveTargets(ch)}
                            onMove={(parentId) => onMoveToParent(ch, parentId)}
                          />
                        }
                      />
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
                      <SortableCategoryItem
                        key={ch.id}
                        category={ch}
                        isChild
                        isGroup={false}
                        onStartEdit={() => onStartEdit(ch)}
                        onDelete={() => onDelete(ch)}
                        moveMenu={
                          <MoveMenu
                            targets={moveTargets(ch)}
                            onMove={(parentId) => onMoveToParent(ch, parentId)}
                          />
                        }
                      />
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
