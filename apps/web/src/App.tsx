import "@mantine/core/styles.css"
import "@mantine/dates/styles.css"
import {
  MantineProvider,
  AppShell,
  NavLink,
  Group,
  Text,
  Burger,
  createTheme,
  rem,
  useMantineColorScheme,
  ActionIcon,
} from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import { ModalsProvider } from "@mantine/modals"
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom"
import {
  IconLayoutDashboard,
  IconTrendingUp,
  IconSettings,
  IconWallet,
  IconSun,
  IconMoon,
} from "@tabler/icons-react"
import { SankeyPage } from "./pages/SankeyPage.js"
import { EvolutionPage } from "./pages/EvolutionPage.js"
import { SettingsPage } from "./pages/SettingsPage.js"

const theme = createTheme({
  fontFamily: '"Outfit", sans-serif',
  headings: { fontFamily: '"Outfit", sans-serif' },
  primaryColor: "indigo",
  fontSizes: {
    xs: "0.8125rem",
    sm: "0.9375rem",
    md: "1.0625rem",
    lg: "1.1875rem",
    xl: "1.375rem",
  },
  components: {
    Card: {
      defaultProps: {
        shadow: "sm",
        radius: "md",
      },
    },
    Paper: {
      defaultProps: {
        radius: "md",
      },
    },
    Modal: {
      defaultProps: {
        radius: "lg",
        overlayProps: { backgroundOpacity: 0.4, blur: 6 },
      },
    },
    Button: {
      defaultProps: {
        radius: "md",
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: "md",
      },
    },
    TextInput: {
      defaultProps: {
        radius: "md",
      },
    },
    NumberInput: {
      defaultProps: {
        radius: "md",
      },
    },
    Select: {
      defaultProps: {
        radius: "md",
      },
    },
    MultiSelect: {
      defaultProps: {
        radius: "md",
      },
    },
    Table: {
      defaultProps: {
        highlightOnHover: true,
        verticalSpacing: "sm",
      },
    },
  },
})

function ColorSchemeToggle() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()
  return (
    <ActionIcon
      variant="subtle"
      size="lg"
      onClick={toggleColorScheme}
      aria-label="Toggle color scheme"
    >
      {colorScheme === "dark" ? (
        <IconSun size={18} stroke={1.5} />
      ) : (
        <IconMoon size={18} stroke={1.5} />
      )}
    </ActionIcon>
  )
}

const NAV_ITEMS = [
  { to: "/", label: "Budget Overview", icon: IconLayoutDashboard },
  { to: "/evolution", label: "Price Evolution", icon: IconTrendingUp },
  { to: "/settings", label: "Settings", icon: IconSettings },
]

function Navigation({ onNav }: { onNav?: () => void }) {
  const location = useLocation()
  return (
    <AppShell.Navbar p="sm">
      <AppShell.Section grow>
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            component={Link}
            to={to}
            label={label}
            leftSection={<Icon size={20} stroke={1.5} />}
            active={location.pathname === to}
            onClick={onNav}
            variant="filled"
            style={{ borderRadius: rem(8), marginBottom: 4 }}
          />
        ))}
      </AppShell.Section>
    </AppShell.Navbar>
  )
}

export function App() {
  const [opened, { toggle, close }] = useDisclosure()

  return (
    <MantineProvider defaultColorScheme="auto" theme={theme}>
      <ModalsProvider>
      <BrowserRouter>
        <AppShell
          navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: !opened } }}
          header={{ height: 60 }}
          padding="md"
        >
          <AppShell.Header
            style={{
              borderBottom: "1px solid var(--mantine-color-default-border)",
            }}
          >
            <Group h="100%" px="md" justify="space-between">
              <Group gap="sm">
                <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
                <IconWallet size={28} stroke={1.5} color="var(--mantine-color-indigo-filled)" />
                <Text
                  size="xl"
                  fw={700}
                  style={{ letterSpacing: "-0.02em" }}
                >
                  HomeBudget
                </Text>
              </Group>
              <ColorSchemeToggle />
            </Group>
          </AppShell.Header>
          <Navigation onNav={close} />
          <AppShell.Main>
            <Routes>
              <Route path="/" element={<SankeyPage />} />
              <Route path="/evolution" element={<EvolutionPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </AppShell.Main>
        </AppShell>
      </BrowserRouter>
      </ModalsProvider>
    </MantineProvider>
  )
}
