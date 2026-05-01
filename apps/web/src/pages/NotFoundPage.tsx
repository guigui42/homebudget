import { Container, Stack, Title, Text, Button, ThemeIcon, rem } from "@mantine/core"
import { IconError404 } from "@tabler/icons-react"
import { Link } from "react-router-dom"

export function NotFoundPage() {
  return (
    <Container size="sm" py="xl">
      <Stack align="center" gap="lg" py={rem(60)}>
        <ThemeIcon variant="light" size={rem(80)} radius="xl" color="gray">
          <IconError404 size={44} stroke={1.5} />
        </ThemeIcon>
        <Title order={2}>Page not found</Title>
        <Text c="dimmed" ta="center" maw={400}>
          The page you're looking for doesn't exist or has been moved.
        </Text>
        <Button component={Link} to="/" variant="light">
          Back to Dashboard
        </Button>
      </Stack>
    </Container>
  )
}
