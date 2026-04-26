import "@mantine/core/styles.css"
import "@mantine/dates/styles.css"
import { MantineProvider, AppShell, NavLink, Group, Title, Burger, createTheme } from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import { ModalsProvider } from "@mantine/modals"
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom"
import { SankeyPage } from "./pages/SankeyPage.js"
import { EvolutionPage } from "./pages/EvolutionPage.js"
import { SettingsPage } from "./pages/SettingsPage.js"

const theme = createTheme({
  fontFamily: '"Outfit", sans-serif',
  headings: { fontFamily: '"Outfit", sans-serif' },
  fontSizes: {
    xs: "0.8125rem",
    sm: "0.9375rem",
    md: "1.0625rem",
    lg: "1.1875rem",
    xl: "1.375rem",
  },
})

function Navigation({ onNav }: { onNav?: () => void }) {
  const location = useLocation()
  return (
    <AppShell.Navbar p="xs">
      <NavLink component={Link} to="/" label="Budget Overview" active={location.pathname === "/"} onClick={onNav} />
      <NavLink component={Link} to="/evolution" label="Price Evolution" active={location.pathname === "/evolution"} onClick={onNav} />
      <NavLink component={Link} to="/settings" label="Settings" active={location.pathname === "/settings"} onClick={onNav} />
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
          navbar={{ width: 220, breakpoint: "sm", collapsed: { mobile: !opened } }}
          header={{ height: 56 }}
          padding="md"
        >
          <AppShell.Header>
            <Group h="100%" px="md">
              <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
              <Title order={3}>HomeBudget</Title>
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
