import { useSortable } from "@dnd-kit/sortable"
import type { DraggableAttributes } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import type { ReactNode } from "react"
import {
  Group,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
  ColorSwatch,
  Box,
  UnstyledButton,
} from "@mantine/core"
import {
  IconGripVertical,
  IconPlus,
  IconEdit,
  IconTrash,
  IconCornerDownRight,
  IconChevronRight,
  IconChevronDown,
  IconCurrencyDollar,
} from "@tabler/icons-react"
import type { ExpenseCategory, PriceEntry } from "../../api/client"
import { formatNumber } from "../../utils/format"

export interface CategoryPriceInfo {
  latest: PriceEntry | null
  count: number
}

interface SortableCategoryItemProps {
  category: ExpenseCategory
  isChild: boolean
  isGroup: boolean
  isDragOverlay?: boolean
  priceInfo?: CategoryPriceInfo
  currency?: string
  isExpanded?: boolean
  onToggleExpand?: () => void
  onStartAdd?: () => void
  onStartEdit: () => void
  onDelete: () => void
  moveMenu?: ReactNode
}

export function SortableCategoryItem({
  category,
  isChild,
  isGroup,
  isDragOverlay,
  priceInfo,
  currency,
  isExpanded,
  onToggleExpand,
  onStartAdd,
  onStartEdit,
  onDelete,
  moveMenu,
}: SortableCategoryItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: category.id,
    data: {
      type: isChild ? "child" : "root",
      category,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  if (isDragOverlay) {
    return (
      <Box
        style={{
          background: "var(--mantine-color-dark-6)",
          borderRadius: "var(--mantine-radius-sm)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
          padding: "6px 8px",
        }}
      >
        <ItemContent
          category={category}
          isChild={isChild}
          isGroup={isGroup}
          onStartAdd={onStartAdd}
          onStartEdit={onStartEdit}
          onDelete={onDelete}
          dragListeners={undefined}
          dragAttributes={undefined}
        />
      </Box>
    )
  }

  return (
    <Box ref={setNodeRef} style={style}>
      <ItemContent
        category={category}
        isChild={isChild}
        isGroup={isGroup}
        priceInfo={priceInfo}
        currency={currency}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        onStartAdd={onStartAdd}
        onStartEdit={onStartEdit}
        onDelete={onDelete}
        dragListeners={listeners}
        dragAttributes={attributes}
        moveMenu={moveMenu}
      />
    </Box>
  )
}

interface ItemContentProps {
  category: ExpenseCategory
  isChild: boolean
  isGroup: boolean
  priceInfo?: CategoryPriceInfo
  currency?: string
  isExpanded?: boolean
  onToggleExpand?: () => void
  onStartAdd?: () => void
  onStartEdit: () => void
  onDelete: () => void
  dragListeners: Record<string, Function> | undefined
  dragAttributes: DraggableAttributes | undefined
  moveMenu?: ReactNode
}

function ItemContent({
  category,
  isChild,
  isGroup,
  priceInfo,
  currency,
  isExpanded,
  onToggleExpand,
  onStartAdd,
  onStartEdit,
  onDelete,
  dragListeners,
  dragAttributes,
  moveMenu,
}: ItemContentProps) {
  const hasPrice = priceInfo && (priceInfo.latest || priceInfo.count > 0)
  const showPricePill = (!isGroup || hasPrice) && onToggleExpand

  return (
    <Group gap="sm" py={6} pl={isChild ? 28 : 0} wrap="nowrap">
      <ActionIcon
        variant="subtle"
        size="sm"
        c="dimmed"
        style={{ cursor: "grab", touchAction: "none" }}
        {...(dragListeners ?? {})}
        {...(dragAttributes ?? {})}
        aria-label={`Reorder ${category.name}`}
      >
        <IconGripVertical size={14} />
      </ActionIcon>

      {isChild && <IconCornerDownRight size={14} color="var(--mantine-color-dimmed)" />}
      {category.color && <ColorSwatch size={isChild ? 12 : 14} color={category.color} />}
      <Text fw={isGroup ? 600 : 400} style={{ flex: 1 }}>{category.name}</Text>
      <Badge size="sm" variant="outline">{category.frequency}</Badge>

      {showPricePill && <PricePill priceInfo={priceInfo} currency={currency} isExpanded={isExpanded} onToggle={onToggleExpand} />}

      {!isChild && (
        <Tooltip label="Add sub-category" withArrow>
          <ActionIcon variant="subtle" size="sm" c="dimmed" onClick={onStartAdd}>
            <IconPlus size={14} />
          </ActionIcon>
        </Tooltip>
      )}
      {moveMenu}
      <Tooltip label="Edit" withArrow>
        <ActionIcon variant="subtle" size="sm" onClick={onStartEdit}>
          <IconEdit size={14} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Delete" withArrow>
        <ActionIcon variant="subtle" color="red" size="sm" onClick={onDelete}>
          <IconTrash size={14} />
        </ActionIcon>
      </Tooltip>
    </Group>
  )
}

// ---------------------------------------------------------------------------
// Price Pill — clickable badge that toggles the price expansion panel
// ---------------------------------------------------------------------------

interface PricePillProps {
  priceInfo?: CategoryPriceInfo
  currency?: string
  isExpanded?: boolean
  onToggle?: () => void
}

function PricePill({ priceInfo, currency, isExpanded, onToggle }: PricePillProps) {
  const hasLatest = priceInfo?.latest != null
  const historyCount = priceInfo?.count ?? 0
  const chevron = isExpanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />

  if (hasLatest) {
    return (
      <Tooltip label={isExpanded ? "Hide price history" : `${historyCount} ${historyCount === 1 ? "entry" : "entries"} — click to manage`} withArrow>
        <UnstyledButton
          onClick={onToggle}
          aria-label={isExpanded ? "Hide price history" : "Show price history"}
          aria-expanded={isExpanded}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px 3px 8px",
            borderRadius: "var(--mantine-radius-xl)",
            background: isExpanded
              ? "var(--mantine-color-blue-light)"
              : "var(--mantine-color-dark-5)",
            border: isExpanded
              ? "1px solid var(--mantine-color-blue-4)"
              : "1px solid var(--mantine-color-dark-4)",
            cursor: "pointer",
            transition: "all 150ms ease",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <Text size="sm" fw={600} span c={isExpanded ? "blue.3" : undefined} style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatNumber(priceInfo!.latest!.amount, 2)}
          </Text>
          <Text size="xs" span c="dimmed">
            {currency}
          </Text>
          <Box c={isExpanded ? "blue.3" : "dimmed"} style={{ display: "flex", alignItems: "center", marginLeft: 2 }}>
            {chevron}
          </Box>
        </UnstyledButton>
      </Tooltip>
    )
  }

  // Empty state — dashed "Set price" pill
  return (
    <Tooltip label="Click to set a price for this category" withArrow>
      <UnstyledButton
        onClick={onToggle}
        aria-label="Set price"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 10px 3px 8px",
          borderRadius: "var(--mantine-radius-xl)",
          background: "transparent",
          border: "1px dashed var(--mantine-color-dark-3)",
          cursor: "pointer",
          transition: "all 150ms ease",
        }}
      >
        <IconCurrencyDollar size={13} color="var(--mantine-color-dimmed)" />
        <Text size="xs" c="dimmed" span>
          Set price
        </Text>
      </UnstyledButton>
    </Tooltip>
  )
}
