import "@mantine/core/styles.css"
import "@mantine/dates/styles.css"
import { MantineProvider, AppShell, NavLink, Group, Title } from "@mantine/core"
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom"
import { SankeyPage } from "./pages/SankeyPage.js"
import { EvolutionPage } from "./pages/EvolutionPage.js"
import { SettingsPage } from "./pages/SettingsPage.js"

function Navigation() {
  const location = useLocation()
  return (
    <AppShell.Navbar p="xs">
      <NavLink component={Link} to="/" label="Budget Overview" active={location.pathname === "/"} />
      <NavLink component={Link} to="/evolution" label="Price Evolution" active={location.pathname === "/evolution"} />
      <NavLink component={Link} to="/settings" label="Settings" active={location.pathname === "/settings"} />
    </AppShell.Navbar>
  )
}

export function App() {
  return (
    <MantineProvider defaultColorScheme="auto">
      <BrowserRouter>
        <AppShell navbar={{ width: 220, breakpoint: "sm" }} padding="md">
          <AppShell.Header>
            <Group h="100%" px="md">
              <Title order={3}>HomeBudget</Title>
            </Group>
          </AppShell.Header>
          <Navigation />
          <AppShell.Main>
            <Routes>
              <Route path="/" element={<SankeyPage />} />
              <Route path="/evolution" element={<EvolutionPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </AppShell.Main>
        </AppShell>
      </BrowserRouter>
    </MantineProvider>
  )
}
