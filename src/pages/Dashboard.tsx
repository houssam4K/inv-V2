import * as React from "react"
import {
  Package,
  TrendingDown,
  TrendingUp,
  Layers,
  AlertTriangle,
  Clock,
  ArrowUpCircle,
  ArrowDownCircle,
  Truck,
  DollarSign,
  Factory,
  CalendarClock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { supabase } from "@/lib/supabase"
import { UNITS, type RawMaterial, type StockMovement, type ExpectedShipment } from "@/lib/types"

interface RecentMovement extends StockMovement {
  raw_materials: { name: string; unit_of_measure: string } | null
}

interface ShipmentSpendRow {
  quantity: number
  unit_price: number
  suppliers: { name: string } | null
}

interface ProductionRow {
  quantity: number
  products: { name: string } | null
}

function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

function formatCurrency(n: number) {
  return n.toLocaleString() + " DA"
}

function currentMonthRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const start = `${y}-${String(m).padStart(2, "0")}-01`
  const endMon = m === 12 ? 1 : m + 1
  const endYear = m === 12 ? y + 1 : y
  const end = `${endYear}-${String(endMon).padStart(2, "0")}-01`
  return { start, end }
}

export function Dashboard() {
  const [materials, setMaterials] = React.useState<RawMaterial[]>([])
  const [recentMovements, setRecentMovements] = React.useState<RecentMovement[]>([])
  const [expectedShipments, setExpectedShipments] = React.useState<ExpectedShipment[]>([])
  const [monthShipments, setMonthShipments] = React.useState<ShipmentSpendRow[]>([])
  const [monthProduction, setMonthProduction] = React.useState<ProductionRow[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      const { start, end } = currentMonthRange()

      const [matRes, movRes, shipRes, financeRes, prodRes] = await Promise.all([
        supabase.from("raw_materials").select("*").order("name"),
        supabase
          .from("stock_movements")
          .select("*, raw_materials(name, unit_of_measure)")
          .order("date", { ascending: false })
          .limit(10),
        supabase
          .from("expected_shipments")
          .select("*")
          .eq("status", "pending")
          .order("expected_date", { ascending: true })
          .limit(6),
        supabase
          .from("shipments")
          .select("quantity, unit_price, suppliers(name)")
          .gte("date", start)
          .lt("date", end),
        supabase
          .from("production_entries")
          .select("quantity, products(name)")
          .gte("date", start)
          .lt("date", end),
      ])

      setMaterials((matRes.data as RawMaterial[]) ?? [])
      setRecentMovements((movRes.data as RecentMovement[]) ?? [])
      setExpectedShipments((shipRes.data as ExpectedShipment[]) ?? [])
      setMonthShipments((financeRes.data as ShipmentSpendRow[]) ?? [])
      setMonthProduction((prodRes.data as ProductionRow[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // ---- Existing stats (unchanged logic) ----
  const totalMaterials = materials.length
  const zeroStock = materials.filter((m) => m.current_quantity === 0).length
  const inStock = materials.filter((m) => m.current_quantity > 0).length

  // ---- Running-out-soon: same days-remaining formula as MaterialDetail.tsx / StockStatus.tsx ----
  const runningOut = React.useMemo(() => {
    return materials
      .filter((m) => m.daily_consumption != null && m.daily_consumption > 0)
      .map((m) => ({
        material: m,
        daysRemaining: Math.floor(
          Number(m.current_quantity) / Number(m.daily_consumption)
        ),
      }))
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
  }, [materials])

  const outOfStockMaterials = React.useMemo(
    () => materials.filter((m) => m.current_quantity === 0),
    [materials]
  )

  // ---- Finance: same total-spend formula as Finance.tsx ----
  const monthSpend = React.useMemo(
    () => monthShipments.reduce((acc, r) => acc + r.quantity * r.unit_price, 0),
    [monthShipments]
  )

  const topSupplierThisMonth = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const r of monthShipments) {
      const name = r.suppliers?.name ?? "Unknown"
      map.set(name, (map.get(name) ?? 0) + r.quantity * r.unit_price)
    }
    let best: { name: string; total: number } | null = null
    for (const [name, total] of map) {
      if (!best || total > best.total) best = { name, total }
    }
    return best
  }, [monthShipments])

  // ---- Production: total pallets this month, broken down by product ----
  const productionByProduct = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const r of monthProduction) {
      const name = r.products?.name ?? "Unknown"
      map.set(name, (map.get(name) ?? 0) + r.quantity)
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
  }, [monthProduction])

  const totalProductionThisMonth = React.useMemo(
    () => monthProduction.reduce((acc, r) => acc + r.quantity, 0),
    [monthProduction]
  )

  // ---- Expected shipments: overdue / today flags, same logic as TeamBoard.tsx ----
  const todayStr = new Date().toISOString().split("T")[0]
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0))
  const overdueCount = expectedShipments.filter(
    (s) => new Date(s.expected_date) < startOfToday
  ).length

  return (
    <div className="flex flex-col gap-8 p-6 max-w-5xl mx-auto w-full">
      <div>
        <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your raw material inventory.</p>
      </div>

      {/* Stats — unchanged logic, extended with two more KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Layers className="size-4" />
              Total Materials
            </CardDescription>
            <CardTitle className="text-4xl font-bold">
              {loading ? <Skeleton className="h-10 w-16" /> : totalMaterials}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">tracked raw materials</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="size-4 text-emerald-500" />
              In Stock
            </CardDescription>
            <CardTitle className="text-4xl font-bold">
              {loading ? <Skeleton className="h-10 w-16" /> : inStock}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">materials with quantity &gt; 0</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingDown className="size-4 text-destructive" />
              Out of Stock
            </CardDescription>
            <CardTitle className="text-4xl font-bold">
              {loading ? <Skeleton className="h-10 w-16" /> : zeroStock}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">materials at zero quantity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="size-4 text-primary" />
              Spend This Month
            </CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {loading ? <Skeleton className="h-8 w-24" /> : formatCurrency(monthSpend)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground truncate">
              {loading
                ? " "
                : topSupplierThisMonth
                ? `top: ${topSupplierThisMonth.name}`
                : "no purchases yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Truck className="size-4 text-blue-500" />
              Pending Shipments
            </CardDescription>
            <CardTitle className="text-4xl font-bold">
              {loading ? <Skeleton className="h-10 w-16" /> : expectedShipments.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-sm ${overdueCount > 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
              {loading ? " " : overdueCount > 0 ? `${overdueCount} overdue` : "on track"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Running Out Soon + Expected Shipments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="size-4 text-amber-500" />
              Running Out Soon
            </CardTitle>
            <CardDescription>
              Materials with a daily consumption set, sorted by urgency.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col gap-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : runningOut.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No forecast data yet. Set a daily consumption on a material to see it here.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {runningOut.slice(0, 6).map(({ material: m, daysRemaining }) => {
                  const urgent = daysRemaining <= 3
                  const warn = !urgent && daysRemaining <= 7
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between rounded-md px-3 py-2 transition-colors ${
                        urgent
                          ? "bg-destructive/10"
                          : warn
                          ? "bg-amber-50 dark:bg-amber-950/20"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.current_quantity} {m.unit_of_measure} left
                        </p>
                      </div>
                      <Badge
                        variant={urgent ? "destructive" : "outline"}
                        className={
                          !urgent && warn
                            ? "text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-900 shrink-0"
                            : "shrink-0"
                        }
                      >
                        {daysRemaining} {daysRemaining === 1 ? "day" : "days"}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Truck className="size-4 text-blue-500" />
              Expected Shipments
            </CardTitle>
            <CardDescription>Pending deliveries, soonest first.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col gap-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : expectedShipments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No pending shipments. Add one from Team Board.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {expectedShipments.map((s) => {
                  const isOverdue = new Date(s.expected_date) < startOfToday
                  const isToday = s.expected_date === todayStr
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center justify-between gap-3 rounded-md px-3 py-2 transition-colors ${
                        isOverdue ? "bg-destructive/10" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CalendarClock className="size-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{s.supplier_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{s.description}</p>
                        </div>
                      </div>
                      {isOverdue ? (
                        <Badge variant="destructive" className="shrink-0">Overdue</Badge>
                      ) : isToday ? (
                        <Badge className="bg-amber-500 hover:bg-amber-600 shrink-0">Today</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {fmtShortDate(s.expected_date)}
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity + Production This Month */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Clock className="size-4" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest stock movements across all materials.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col gap-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recentMovements.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No stock movements recorded yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {recentMovements.map((mov) => {
                  const isIn = mov.movement_type === "IN"
                  return (
                    <div
                      key={mov.id}
                      className="flex items-center justify-between gap-3 rounded-md px-3 py-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isIn ? (
                          <ArrowUpCircle className="size-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <ArrowDownCircle className="size-3.5 text-amber-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {mov.raw_materials?.name ?? "Unknown material"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {fmtShortDate(mov.date)}
                            {mov.supplier_name ? ` · ${mov.supplier_name}` : ""}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-sm font-semibold tabular-nums shrink-0 ${
                          isIn
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {isIn ? "+" : "−"}
                        {mov.quantity}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Factory className="size-4 text-primary" />
              Production This Month
            </CardTitle>
            <CardDescription>
              {loading ? "Loading…" : `${totalProductionThisMonth.toLocaleString()} pallets total`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col gap-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : productionByProduct.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No production entries yet this month.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {productionByProduct.map((p) => {
                  const pct =
                    totalProductionThisMonth > 0
                      ? Math.round((p.total / totalProductionThisMonth) * 100)
                      : 0
                  return (
                    <div key={p.name} className="flex flex-col gap-1 px-3 py-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate">{p.name}</span>
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          {p.total.toLocaleString()} pallets
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Needs Reordering — quick out-of-stock list */}
      {!loading && outOfStockMaterials.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-destructive">
              <TrendingDown className="size-4" />
              Needs Reordering
            </CardTitle>
            <CardDescription>Materials currently at zero stock.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {outOfStockMaterials.map((m) => (
                <Badge key={m.id} variant="outline" className="text-destructive border-destructive/30">
                  {m.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stock summary — unchanged */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Package className="size-4" />
            Current Stock Levels
          </CardTitle>
          <CardDescription>Quick view of all materials and their quantities.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : materials.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No materials yet. Go to Stock Status to add your first material.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {materials.map((m) => {
                const unitLabel = UNITS.find((u) => u.value === m.unit_of_measure)?.label ?? m.unit_of_measure
                const isEmpty = m.current_quantity === 0
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium truncate">{m.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{unitLabel}</span>
                    </div>
                    <Badge
                      variant={isEmpty ? "outline" : "secondary"}
                      className={isEmpty ? "text-destructive border-destructive/30" : ""}
                    >
                      {isEmpty ? "Out of stock" : `${m.current_quantity} ${m.unit_of_measure}`}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
