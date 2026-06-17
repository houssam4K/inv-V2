import * as React from "react"
import { Building2, Factory, LayoutDashboard, Package, TrendingUp } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ModeToggle } from "@/components/mode-toggle"
import { Dashboard } from "@/pages/Dashboard"
import { StockStatus } from "@/pages/StockStatus"
import { Production } from "@/pages/Production"
import { Suppliers } from "@/pages/Suppliers"
import { Finance } from "@/pages/Finance"

type Page = "dashboard" | "stock-status" | "production" | "suppliers" | "finance"

const NAV_ITEMS: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "stock-status", label: "Stock Status", icon: Package },
  { id: "production", label: "Production", icon: Factory },
  { id: "suppliers", label: "Suppliers", icon: Building2 },
  { id: "finance", label: "Finance", icon: TrendingUp },
]

export function App() {
  const [page, setPage] = React.useState<Page>("dashboard")

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Package className="size-4" />
            </div>
            <span className="font-semibold text-sm truncate group-data-[collapsible=icon]:hidden">
              RawTrack
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={page === item.id}
                      onClick={() => setPage(item.id)}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm font-medium text-muted-foreground">
            {NAV_ITEMS.find((n) => n.id === page)?.label}
          </span>
          <div className="ml-auto">
            <ModeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          {page === "dashboard" && <Dashboard />}
          {page === "stock-status" && <StockStatus />}
          {page === "production" && <Production />}
          {page === "suppliers" && <Suppliers />}
          {page === "finance" && <Finance />}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
