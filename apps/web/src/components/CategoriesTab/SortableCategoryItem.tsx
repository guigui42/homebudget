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
} from "@mantine/core"
import {
  IconGripVertical,
  IconPlus,
  IconEdit,
  IconTrash,
  IconCornerDownRight,
} from "@tabler/icons-react"
import type { ExpenseCategory } from "../../api/client"

interface SortableCategoryItemProps {
  category: ExpenseCategory
  isChild: boolean
  isGroup: boolean
  isDragOverlay?: boolean
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
  onStartAdd,
  onStartEdit,
  onDelete,
  dragListeners,
  dragAttributes,
  moveMenu,
}: ItemContentProps) {
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
