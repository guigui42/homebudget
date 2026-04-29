import {
  Group,
  TextInput,
  Select,
  ColorInput,
  ActionIcon,
} from "@mantine/core"
import { IconCornerDownRight, IconCheck, IconX } from "@tabler/icons-react"
import { CHART_COLORS } from "../../constants"

export interface DraftData {
  name: string
  frequency: string
  color: string
}

interface CategoryDraftRowProps {
  draft: DraftData
  onChange: (draft: DraftData) => void
  onSubmit: () => void
  onCancel: () => void
  indent?: boolean
}

export function CategoryDraftRow({ draft, onChange, onSubmit, onCancel, indent }: CategoryDraftRowProps) {
  return (
    <Group gap="sm" py={8} pl={indent ? 28 : 0} wrap="wrap">
      {indent && <IconCornerDownRight size={14} color="var(--mantine-color-dimmed)" />}
      <TextInput
        placeholder="Category name"
        size="sm"
        value={draft.name}
        onChange={(e) => onChange({ ...draft, name: e.target.value })}
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
        onChange={(v) => onChange({ ...draft, frequency: v ?? "monthly" })}
        w={120}
        allowDeselect={false}
      />
      <ColorInput
        size="sm"
        placeholder="Color"
        value={draft.color}
        onChange={(v) => onChange({ ...draft, color: v })}
        w={140}
        swatches={CHART_COLORS}
      />
      <Group gap={4} wrap="nowrap">
        <ActionIcon size="md" variant="filled" color="blue" onClick={onSubmit} disabled={!draft.name}>
          <IconCheck size={16} />
        </ActionIcon>
        <ActionIcon size="md" variant="subtle" color="gray" onClick={onCancel}>
          <IconX size={16} />
        </ActionIcon>
      </Group>
    </Group>
  )
}
