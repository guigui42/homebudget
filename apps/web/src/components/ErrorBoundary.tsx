import { Component, type ReactNode } from "react"
import { Stack, Title, Text, Button, Paper, ThemeIcon, rem } from "@mantine/core"
import { IconAlertTriangle } from "@tabler/icons-react"

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <Paper withBorder p="xl" m="md" radius="lg">
        <Stack align="center" gap="md" py="xl">
          <ThemeIcon variant="light" size={rem(60)} radius="xl" color="red">
            <IconAlertTriangle size={32} stroke={1.5} />
          </ThemeIcon>
          <Title order={3}>
            {this.props.fallbackTitle ?? "Something went wrong"}
          </Title>
          <Text c="dimmed" ta="center" maw={500} size="sm">
            An unexpected error occurred. You can try reloading the page
            or going back to the previous screen.
          </Text>
          <Button
            variant="light"
            onClick={() => {
              this.setState({ error: null })
              window.location.reload()
            }}
          >
            Reload Page
          </Button>
        </Stack>
      </Paper>
    )
  }
}
