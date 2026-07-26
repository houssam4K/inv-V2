import * as React from "react"
import {
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Factory,
  TrendingUp,
  Package,
  CalendarDays,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  LineChart,
  Line,
  Legend,
} from "recharts"
import { supabase } from "@/lib/supabase"
import type { RawMaterial, StockMovement, BOMItem } from "@/lib/types"

// ── Static product specs + BOM ───────────────────────────────────────────────
const PRODUCT_SPECS = [
  {
    key: "5.5",
    label: "5.5L",
    bottlesPerPallet: 196,
    fardeauxPerPallet: null as number | null,
    bottlesPerFardeau: null as number | null,
    chartColor: "var(--chart-1)",
    bom: [
      "preform 74",
      "bouchon col 38",
      "poignee",
      "etiquette 5.5",
      "film etir",
      "intercalair",
    ],
  },
  {
    key: "1.5",
    label: "1.5L",
    bottlesPerPallet: 672,
    fardeauxPerPallet: 112 as number | null,
    bottlesPerFardeau: 6 as number | null,
    chartColor: "var(--chart-2)",
    bom: [
      "preform 26",
      "bouchon col 29",
      "cole",
      "etiquette 1.5",
      "film etir",
      "intercalair",
      "film thermo 1.5",
    ],
  },
  {
    key: "0.5",
    label: "0.5L",
    bottlesPerPallet: 2100,
    fardeauxPerPallet: 175 as number | null,
    bottlesPerFardeau: 12 as number | null,
    chartColor: "var(--chart-3)",
    bom: [
      "preform 12",
      "bouchon col 29",
      "cole",
      "etiquette 0.5",
      "film etir",
      "intercalair",
      "film thermo 0.5",
    ],
  },
]

type ProductSpec = (typeof PRODUCT_SPECS)[number]

function specForProduct(productName: string): ProductSpec | null {
  return PRODUCT_SPECS.find((s) => productName.includes(s.key)) ?? null
}

// ── Date helpers ─────────────────────────────────────────────────────────────
function monthKey(iso: string) { return iso.slice(0, 7) }
function dayKey(iso: string) { return iso.slice(0, 10) }

function allDaysOfMonth(year: number, month: number): string[] {
  const count = new Date(year, month, 0).getDate()
  return Array.from({ length: count }, (_, i) =>
    `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`
  )
}
function allMonthsOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    `${year}-${String(i + 1).padStart(2, "0")}`
  )
}
function fmtMonthLabel(mk: string) {
  const [y, m] = mk.split("-").map(Number)
  return new Date(y, m - 1).toLocaleDateString("fr-DZ", { month: "short" })
}
function fmtDayLabel(dk: string) {
  return String(new Date(dk + "T12:00:00").getDate())
}
function fmtDA(n: number) { return n.toLocaleString("fr-DZ") + " DA" }

/** Returns true if the day is a work day (not Fri=5 or Sat=6) */
function isWorkday(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00")
  const dow = d.getDay()
  return dow !== 5 && dow !== 6
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ShipmentRow {
  id: string
  date: string
  quantity: number
  unit_price: number
  suppliers: { name: string }
  raw_materials: { name: string }
}

interface ProductionEntryRow {
  id: string
  date: string
  quantity: number
  product_id: string
  products: { name: string }
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  accent?: "emerald" | "amber" | "destructive" | "blue" | "violet"
}) {
  const clr: Record<string, string> = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    destructive: "text-destructive",
    blue: "text-blue-600 dark:text-blue-400",
    violet: "text-violet-600 dark:text-violet-400",
  }
  return (
    <div className="rounded-xl border bg-card px-5 py-4 flex flex-col gap-1.5 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wide">
        <Icon className={`size-3.5 ${accent ? clr[accent] : ""}`} />
        {label}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${accent ? clr[accent] : ""}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

function ChartCard({
  title,
  children,
  empty,
  emptyMsg,
}: {
  title: string
  children: React.ReactNode
  empty?: boolean
  emptyMsg?: string
}) {
  return (
    <div className="rounded-xl border bg-card p-5 flex flex-col gap-3 shadow-sm">
      <p className="text-sm font-semibold">{title}</p>
      {empty ? (
        <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
          {emptyMsg ?? "Aucune donnée pour cette période"}
        </div>
      ) : (
        children
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function Analytics() {
  // ── Period state ────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = React.useState<"month" | "year">("month")
  const [year, setYear] = React.useState(() => new Date().getFullYear())
  const [month, setMonth] = React.useState(() => new Date().getMonth() + 1)

  // ── Data ─────────────────────────────────────────────────────────────────────
  const [materials, setMaterials] = React.useState<RawMaterial[]>([])
  const [movements, setMovements] = React.useState<StockMovement[]>([])
  const [shipments, setShipments] = React.useState<ShipmentRow[]>([])
  const [productionEntries, setProductionEntries] = React.useState<ProductionEntryRow[]>([])
  const [bomItems, setBomItems] = React.useState<BOMItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [trendMode, setTrendMode] = React.useState<'month' | 'week'>('month')
  const [histMovements, setHistMovements] = React.useState<StockMovement[]>([])
  const [histProduction, setHistProduction] = React.useState<ProductionEntryRow[]>([])

  // ── Date range ───────────────────────────────────────────────────────────────
  const { start, end } = React.useMemo(() => {
    if (viewMode === "month") {
      const em = month === 12 ? 1 : month + 1
      const ey = month === 12 ? year + 1 : year
      return {
        start: `${year}-${String(month).padStart(2, "0")}-01`,
        end: `${ey}-${String(em).padStart(2, "0")}-01`,
      }
    }
    return { start: `${year}-01-01`, end: `${year + 1}-01-01` }
  }, [viewMode, year, month])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [matsRes, movsRes, shipRes, prodRes, bomRes] = await Promise.all([
        supabase.from("raw_materials").select("*").order("name"),
        supabase.from("stock_movements").select("*").gte("date", start).lt("date", end).order("date"),
        supabase.from("shipments").select("*, suppliers(name), raw_materials(name)").gte("date", start).lt("date", end),
        supabase.from("production_entries").select("*, products(name)").gte("date", start).lt("date", end).order("date"),
        supabase.from("bom_items").select("*, products(name)"),
      ])
      if (cancelled) return
      setMaterials((matsRes.data as RawMaterial[]) ?? [])
      setMovements((movsRes.data as StockMovement[]) ?? [])
      setShipments((shipRes.data as ShipmentRow[]) ?? [])
      setProductionEntries((prodRes.data as ProductionEntryRow[]) ?? [])
      setBomItems((bomRes.data as BOMItem[]) ?? [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [start, end])

  React.useEffect(() => {
    let cancelled = false
    async function loadHist() {
      const now = new Date()
      const d = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      const histStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`

      const [movsRes, prodRes] = await Promise.all([
        supabase.from("stock_movements").select("*").gte("date", histStart).eq("movement_type", "OUT"),
        supabase.from("production_entries").select("*, products(name)").gte("date", histStart),
      ])
      if (cancelled) return
      setHistMovements((movsRes.data as StockMovement[]) ?? [])
      setHistProduction((prodRes.data as ProductionEntryRow[]) ?? [])
    }
    loadHist()
    return () => { cancelled = true }
  }, [])

  // ── Navigation ───────────────────────────────────────────────────────────────
  function prev() {
    if (viewMode === "month") {
      if (month === 1) { setMonth(12); setYear((y) => y - 1) } else setMonth((m) => m - 1)
    } else setYear((y) => y - 1)
  }
  function next() {
    if (viewMode === "month") {
      if (month === 12) { setMonth(1); setYear((y) => y + 1) } else setMonth((m) => m + 1)
    } else setYear((y) => y + 1)
  }

  const periodLabel = React.useMemo(() => {
    if (viewMode === "month")
      return new Date(year, month - 1).toLocaleDateString("fr-DZ", { year: "numeric", month: "long" })
    return String(year)
  }, [viewMode, year, month])

  // ── Derived data ─────────────────────────────────────────────────────────────
  const outMovements = movements.filter((m) => m.movement_type === "OUT")
  const totalSpent = shipments.reduce((s, r) => s + r.quantity * r.unit_price, 0)

  // ── Per-product aggregates ────────────────────────────────────────────────
  const productTotals = React.useMemo(() => {
    const map = new Map<string, { pallets: number; spec: ProductSpec | null }>()
    for (const e of productionEntries) {
      const name = e.products?.name ?? "Unknown"
      const prev = map.get(name) ?? { pallets: 0, spec: specForProduct(name) }
      map.set(name, { ...prev, pallets: prev.pallets + e.quantity })
    }
    const order = ["5.5", "1.5", "0.5"]
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v, bottles: v.spec ? v.pallets * v.spec.bottlesPerPallet : v.pallets }))
      .sort((a, b) => {
        const ai = a.spec ? order.indexOf(a.spec.key) : 99
        const bi = b.spec ? order.indexOf(b.spec.key) : 99
        return ai - bi
      })
  }, [productionEntries])

  const totalPalletsAll = productTotals.reduce((s, p) => s + p.pallets, 0)
  const totalBottlesAll = productTotals.reduce((s, p) => s + p.bottles, 0)

  // ── Cost per Bottle ───────────────────────────────────────────────────────
  const costPerBottle = totalBottlesAll > 0 && totalSpent > 0
    ? totalSpent / totalBottlesAll
    : null

  // ── Avg daily production (pallets / working days with entries) ─────────────
  const avgDailyPallets = React.useMemo(() => {
    const periods = viewMode === "month" ? allDaysOfMonth(year, month) : allMonthsOfYear(year)
    const workdays = viewMode === "month"
      ? periods.filter(isWorkday)
      : periods  // for year view, just use all months

    // Only count days/months that had at least some production
    const activePeriods = workdays.filter((p) => {
      const key = viewMode === "month" ? dayKey : monthKey
      return productionEntries.some((e) => {
        const pk = viewMode === "month" ? dayKey(e.date) : monthKey(e.date)
        return pk === key(p)
      })
    })

    if (activePeriods.length === 0) return null
    return totalPalletsAll / activePeriods.length
  }, [productionEntries, totalPalletsAll, viewMode, year, month])

  // ── Critical material ────────────────────────────────────────────────────────
  const criticalMaterial = React.useMemo(() => {
    return materials
      .filter((m) => m.daily_consumption && m.daily_consumption > 0)
      .map((m) => ({ ...m, daysLeft: Math.floor(m.current_quantity / m.daily_consumption!) }))
      .sort((a, b) => a.daysLeft - b.daysLeft)[0] ?? null
  }, [materials])

  // ── Chart A: Production per product over time ─────────────────────────────
  const productNames = productTotals.map((p) => p.name)

  const productionTimeData = React.useMemo(() => {
    const periods = viewMode === "month" ? allDaysOfMonth(year, month) : allMonthsOfYear(year)
    return periods.map((period) => {
      const label = viewMode === "month" ? fmtDayLabel(period) : fmtMonthLabel(period)
      const obj: Record<string, number | string> = { label }
      for (const name of productNames) {
        obj[name] = productionEntries
          .filter((e) => {
            const pk = viewMode === "month" ? dayKey(e.date) : monthKey(e.date)
            return e.products?.name === name && pk === period
          })
          .reduce((s, e) => s + e.quantity, 0)
      }
      return obj
    })
  }, [productionEntries, productNames, viewMode, year, month])

  const prodChartConfig = React.useMemo(() => {
    const cfg: Record<string, { label: string; color: string }> = {}
    productTotals.forEach((p) => {
      cfg[p.name] = { label: p.name, color: p.spec?.chartColor ?? "var(--chart-4)" }
    })
    return cfg
  }, [productTotals])

  const prodChartEmpty = productionTimeData.every((row) =>
    productNames.every((n) => (row[n] as number) === 0)
  )

  // ── Chart D: Spending per supplier ────────────────────────────────────────
  const supplierSpendData = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const s of shipments) {
      const name = s.suppliers.name
      map.set(name, (map.get(name) ?? 0) + s.quantity * s.unit_price)
    }
    return Array.from(map.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total)
  }, [shipments])

  // ── Spending over time ────────────────────────────────────────────────────
  const spendingTimeData = React.useMemo(() => {
    const periods = viewMode === "month" ? allDaysOfMonth(year, month) : allMonthsOfYear(year)
    return periods.map((period) => {
      const label = viewMode === "month" ? fmtDayLabel(period) : fmtMonthLabel(period)
      const total = shipments
        .filter((s) => {
          const pk = viewMode === "month" ? dayKey(s.date) : monthKey(s.date)
          return pk === period
        })
        .reduce((sum, s) => sum + s.quantity * s.unit_price, 0)
      return { label, total }
    })
  }, [shipments, viewMode, year, month])

  const spendingChartEmpty = spendingTimeData.every((r) => r.total === 0)

  // ── Stock Coverage table ──────────────────────────────────────────────────
  const stockCoverageRows = React.useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return materials
      .filter((m) => m.daily_consumption && m.daily_consumption > 0)
      .map((m) => {
        const daysLeft = Math.floor(m.current_quantity / m.daily_consumption!)
        const reorderDate = new Date(today)
        reorderDate.setDate(today.getDate() + daysLeft)
        return {
          mat: m,
          daysLeft,
          reorderDate: reorderDate.toLocaleDateString("fr-DZ", { day: "numeric", month: "short", year: "numeric" }),
          urgency: daysLeft <= 3 ? "critical" : daysLeft <= 7 ? "low" : "ok",
        }
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
  }, [materials])

  // ── Waste rows (Consumption tab) ─────────────────────────────────────────────
  const wasteRows = React.useMemo(() => {
    const matIds = [...new Set(bomItems.map((b) => b.raw_material_id))]
    return matIds.flatMap((matId) => {
      const mat = materials.find((m) => m.id === matId)
      if (!mat) return []

      const actual = outMovements
        .filter((mv) => mv.raw_material_id === matId)
        .reduce((s, mv) => s + Number(mv.quantity), 0)

      let theoretical = 0
      let hasUnknown = false

      for (const bomItem of bomItems.filter((b) => b.raw_material_id === matId)) {
        const spec = PRODUCT_SPECS.find((s) => bomItem.products?.name?.includes(s.key))
        if (!spec) continue

        const pallets = productionEntries
          .filter((e) => e.products?.name === bomItem.products?.name)
          .reduce((s, e) => s + Number(e.quantity), 0)

        const qty = Number(bomItem.quantity_per_unit)

        switch (bomItem.unit_type) {
          case 'per_bottle':
            theoretical += pallets * spec.bottlesPerPallet * qty
            break
          case 'per_fardeau':
            if (spec.fardeauxPerPallet == null) {
              hasUnknown = true
            } else {
              theoretical += pallets * spec.fardeauxPerPallet * qty
            }
            break
          case 'per_pallet':
            theoretical += pallets * qty
            break
          case 'unknown':
            hasUnknown = true
            break
        }
      }

      const waste = hasUnknown ? null : actual - theoretical
      const wastePct =
        waste !== null && actual > 0 ? (waste / actual) * 100 : null

      return [{ mat, unit: mat.unit_of_measure, actual, theoretical: hasUnknown ? null : theoretical, waste, wastePct, hasUnknown }]
    })
  }, [materials, outMovements, productionEntries, bomItems])

  // ── trendData (Consumption tab) ──────────────────────────────────────────────
  const { trendData, materialNames } = React.useMemo(() => {
    const now = new Date()
    const periods: { label: string; start: Date; end: Date }[] = []

    if (trendMode === 'month') {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const nextD = new Date(d.getFullYear(), d.getMonth() + 1, 1)
        const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        periods.push({ label, start: d, end: nextD })
      }
    } else {
      const todayDay = now.getDay() === 0 ? 6 : now.getDay() - 1
      const thisMonday = new Date(now)
      thisMonday.setHours(0, 0, 0, 0)
      thisMonday.setDate(now.getDate() - todayDay)
      for (let i = 7; i >= 0; i--) {
        const start = new Date(thisMonday)
        start.setDate(thisMonday.getDate() - i * 7)
        const end = new Date(start)
        end.setDate(start.getDate() + 7)
        const jan1 = new Date(start.getFullYear(), 0, 1)
        const weekNum = Math.ceil(((start.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
        periods.push({ label: `W${weekNum}`, start, end })
      }
    }

    const matIds = [...new Set(bomItems.map((b) => b.raw_material_id))]
    const allMatNames: string[] = []

    const rows = periods.map((period) => {
      const obj: Record<string, number | string | null> = { label: period.label }

      for (const matId of matIds) {
        const mat = materials.find((m) => m.id === matId)
        if (!mat) continue
        if (!allMatNames.includes(mat.name)) allMatNames.push(mat.name)

        const actual = histMovements
          .filter((mv) => {
            const d = new Date(mv.date)
            return mv.raw_material_id === matId && d >= period.start && d < period.end
          })
          .reduce((s, mv) => s + Number(mv.quantity), 0)

        let theoretical = 0
        let hasUnknown = false

        for (const bomItem of bomItems.filter((b) => b.raw_material_id === matId)) {
          const spec = PRODUCT_SPECS.find((s) => bomItem.products?.name?.includes(s.key))
          if (!spec) continue

          const pallets = histProduction
            .filter((e) => {
              const d = new Date(e.date)
              return e.products?.name === bomItem.products?.name && d >= period.start && d < period.end
            })
            .reduce((s, e) => s + Number(e.quantity), 0)

          const qty = Number(bomItem.quantity_per_unit)

          switch (bomItem.unit_type) {
            case 'per_bottle':
              theoretical += pallets * spec.bottlesPerPallet * qty
              break
            case 'per_fardeau':
              if (spec.fardeauxPerPallet == null) { hasUnknown = true } else {
                theoretical += pallets * spec.fardeauxPerPallet * qty
              }
              break
            case 'per_pallet':
              theoretical += pallets * qty
              break
            case 'unknown':
              hasUnknown = true
              break
          }
        }

        const wastePct =
          hasUnknown || actual === 0
            ? null
            : ((actual - theoretical) / actual) * 100

        obj[mat.name] = wastePct
      }

      return obj
    })

    return { trendData: rows, materialNames: allMatNames }
  }, [bomItems, materials, histMovements, histProduction, trendMode])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight flex items-center gap-2">
            <BarChart3 className="size-7 text-muted-foreground" />
            Analytics
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Production, dépenses et efficacité de consommation.
          </p>
        </div>

        {/* ── Period selector ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border overflow-hidden text-sm font-medium">
            {(["month", "year"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3.5 py-1.5 transition-colors ${
                  viewMode === mode ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {mode === "month" ? "Mois" : "Année"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" className="size-8" onClick={prev}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-medium min-w-[150px] text-center capitalize">{periodLabel}</span>
            <Button variant="outline" size="icon" className="size-8" onClick={next}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : (
        <Tabs defaultValue="production">
          <TabsList>
            <TabsTrigger value="production">Production</TabsTrigger>
            <TabsTrigger value="spending">Stock & Dépenses</TabsTrigger>
            <TabsTrigger value="consumption">Consommation</TabsTrigger>
          </TabsList>

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 1 — PRODUCTION
          ═══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="production" className="mt-4 flex flex-col gap-6">

            {/* ── KPI cards ──────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryCard
                icon={Factory}
                label="Total Produit"
                value={totalBottlesAll.toLocaleString()}
                sub={`${totalPalletsAll.toLocaleString()} palettes`}
                accent="emerald"
              />
              <SummaryCard
                icon={DollarSign}
                label="Dépenses Période"
                value={fmtDA(totalSpent)}
                sub={`${shipments.length} livraisons`}
                accent="blue"
              />
              <SummaryCard
                icon={TrendingUp}
                label="Coût / Bouteille"
                value={
                  costPerBottle !== null
                    ? `${costPerBottle.toFixed(2)} DA`
                    : "—"
                }
                sub={costPerBottle !== null ? "matières premières" : "Pas de données"}
                accent="violet"
              />
              <SummaryCard
                icon={CalendarDays}
                label="Moy. / Jour Ouvré"
                value={
                  avgDailyPallets !== null
                    ? `${avgDailyPallets.toFixed(1)}`
                    : "—"
                }
                sub={avgDailyPallets !== null ? "palettes / jour" : "Pas de production"}
                accent="amber"
              />
            </div>

            {/* ── Per-product mini-cards ─────────────────────────────────────── */}
            {productTotals.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {productTotals.map((p) => (
                  <div
                    key={p.name}
                    className="rounded-xl border bg-card px-5 py-4 flex flex-col gap-2 shadow-sm"
                    style={{ borderLeftWidth: 4, borderLeftColor: p.spec?.chartColor ?? "var(--border)" }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{p.name}</span>
                      <Badge variant="outline" className="text-xs font-normal">
                        {p.spec?.bottlesPerPallet ?? "?"} btl/palette
                      </Badge>
                    </div>
                    <div className="flex gap-6">
                      <div>
                        <div className="text-xs text-muted-foreground">Palettes</div>
                        <div className="text-xl font-bold tabular-nums">{p.pallets.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Bouteilles</div>
                        <div className="text-xl font-bold tabular-nums">{p.bottles.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Chart A: Production par produit dans le temps ──────────────── */}
            <ChartCard
              title={`Production par produit — ${periodLabel}`}
              empty={prodChartEmpty}
            >
              <div className="h-[240px]">
                <ChartContainer config={prodChartConfig} className="h-full w-full">
                  <BarChart data={productionTimeData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                      interval={viewMode === "month" ? 2 : 0}
                    />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={36} />
                    <ChartTooltip
                      content={<ChartTooltipContent formatter={(v, name) => [`${v} palettes`, name as string]} />}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    {productTotals.map((p) => (
                      <Bar
                        key={p.name}
                        dataKey={p.name}
                        fill={p.spec?.chartColor ?? "var(--chart-4)"}
                        radius={[3, 3, 0, 0]}
                        maxBarSize={40}
                      />
                    ))}
                  </BarChart>
                </ChartContainer>
              </div>
            </ChartCard>

            {/* ── Critical material alert ────────────────────────────────────── */}
            {criticalMaterial && criticalMaterial.daysLeft <= 7 && (
              <div className={`rounded-xl border px-5 py-4 flex items-center gap-3 shadow-sm ${
                criticalMaterial.daysLeft <= 3
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-amber-400/40 bg-amber-50 dark:bg-amber-950/20"
              }`}>
                <AlertTriangle className={`size-5 shrink-0 ${
                  criticalMaterial.daysLeft <= 3 ? "text-destructive" : "text-amber-500"
                }`} />
                <div>
                  <p className="text-sm font-semibold">
                    Stock critique : {criticalMaterial.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Il reste {criticalMaterial.daysLeft} jour{criticalMaterial.daysLeft !== 1 ? "s" : ""} de stock
                    ({criticalMaterial.current_quantity} {criticalMaterial.unit_of_measure}).
                    Vérifiez l'onglet "Stock & Dépenses" pour le détail.
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 2 — STOCK & DÉPENSES
          ═══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="spending" className="mt-4 flex flex-col gap-6">

            {/* ── Spending KPI cards ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <SummaryCard
                icon={DollarSign}
                label="Total Dépensé"
                value={fmtDA(totalSpent)}
                sub={`${shipments.length} livraisons`}
                accent="blue"
              />
              <SummaryCard
                icon={TrendingUp}
                label="Fournisseur Principal"
                value={supplierSpendData[0]?.name ?? "—"}
                sub={supplierSpendData[0] ? fmtDA(supplierSpendData[0].total) : "Aucune livraison"}
                accent="emerald"
              />
              <SummaryCard
                icon={AlertTriangle}
                label="Matière Critique"
                value={
                  criticalMaterial ? (
                    <span className={criticalMaterial.daysLeft <= 3 ? "text-destructive" : criticalMaterial.daysLeft <= 7 ? "text-amber-600 dark:text-amber-400" : ""}>
                      {criticalMaterial.daysLeft}j
                    </span>
                  ) : "—"
                }
                sub={criticalMaterial?.name ?? "Aucune consommation définie"}
                accent={criticalMaterial ? (criticalMaterial.daysLeft <= 3 ? "destructive" : "amber") : undefined}
              />
            </div>

            {/* ── Chart: Dépenses dans le temps ─────────────────────────────── */}
            <ChartCard
              title={`Dépenses dans le temps — ${periodLabel}`}
              empty={spendingChartEmpty}
              emptyMsg="Aucune livraison enregistrée pour cette période."
            >
              <div className="h-[220px]">
                <ChartContainer
                  config={{ total: { label: "DA", color: "var(--chart-2)" } }}
                  className="h-full w-full"
                >
                  <BarChart data={spendingTimeData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                      interval={viewMode === "month" ? 2 : 0}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                      width={52}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent formatter={(v) => [fmtDA(Number(v)), "Dépensé"]} />}
                    />
                    <Bar dataKey="total" fill="var(--color-total)" radius={[3, 3, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ChartContainer>
              </div>
            </ChartCard>

            {/* ── Chart: Dépenses par fournisseur ───────────────────────────── */}
            <ChartCard
              title={`Dépenses par fournisseur — ${periodLabel}`}
              empty={supplierSpendData.length === 0}
            >
              <div style={{ height: Math.max(160, supplierSpendData.length * 40) }}>
                <ChartContainer
                  config={{ total: { label: "DA", color: "var(--chart-4)" } }}
                  className="h-full w-full"
                >
                  <BarChart
                    data={supplierSpendData}
                    layout="vertical"
                    margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid horizontal={false} />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={120} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(v) => [fmtDA(Number(v)), "Dépensé"]} />} />
                    <Bar dataKey="total" fill="var(--color-total)" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            </ChartCard>

            {/* ── Stock Coverage table ───────────────────────────────────────── */}
            <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b bg-muted/20 flex items-center gap-2">
                <Package className="size-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Couverture de stock (basée sur consommation journalière)</p>
              </div>
              {stockCoverageRows.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                  Définissez la consommation journalière de vos matières pour voir ce tableau.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Matière</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Stock actuel</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Cons. / jour</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Jours restants</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Rupture estimée</th>
                        <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {stockCoverageRows.map(({ mat, daysLeft, reorderDate, urgency }) => (
                        <tr
                          key={mat.id}
                          className={
                            urgency === "critical"
                              ? "bg-destructive/5"
                              : urgency === "low"
                              ? "bg-amber-50 dark:bg-amber-950/20"
                              : ""
                          }
                        >
                          <td className="px-4 py-2.5 font-medium">{mat.name}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {mat.current_quantity.toLocaleString()} <span className="text-muted-foreground text-xs">{mat.unit_of_measure}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                            {mat.daily_consumption?.toLocaleString()} <span className="text-xs">{mat.unit_of_measure}/j</span>
                          </td>
                          <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${
                            urgency === "critical"
                              ? "text-destructive"
                              : urgency === "low"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}>
                            {daysLeft}j
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">
                            {reorderDate}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {urgency === "critical" ? (
                              <Badge className="text-xs bg-destructive hover:bg-destructive text-white">Critique</Badge>
                            ) : urgency === "low" ? (
                              <Badge className="text-xs bg-amber-500 hover:bg-amber-500 text-white">Faible</Badge>
                            ) : (
                              <Badge className="text-xs bg-emerald-500 hover:bg-emerald-500 text-white">OK</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 3 — CONSOMMATION
          ═══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="consumption" className="mt-4 flex flex-col gap-6">

            {/* ① Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SummaryCard
                icon={Factory}
                label="Total Actual"
                value={wasteRows.reduce((s, r) => s + r.actual, 0).toLocaleString()}
                accent="blue"
              />
              <SummaryCard
                icon={TrendingUp}
                label="Total Théorique"
                value={
                  wasteRows.some((r) => r.theoretical == null)
                    ? <span className="text-muted-foreground text-lg">Partiel</span>
                    : wasteRows.reduce((s, r) => s + (r.theoretical ?? 0), 0).toLocaleString()
                }
                accent="emerald"
              />
              <SummaryCard
                icon={AlertTriangle}
                label="Total Gaspillage"
                value={wasteRows
                  .filter((r) => r.waste !== null && r.waste > 0)
                  .reduce((s, r) => s + (r.waste ?? 0), 0)
                  .toLocaleString()}
                accent="amber"
              />
            </div>

            {/* ② Consumption vs Theoretical table */}
            <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b bg-muted/20">
                <p className="text-sm font-semibold">Consommation vs Théorique — {periodLabel}</p>
              </div>
              {wasteRows.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                  Aucune entrée BOM configurée. Allez dans Production → BOM pour les définir.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Matière</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Unité</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Réel</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Théorique</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Écart</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Écart %</th>
                        <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {wasteRows.map((row) => (
                        <tr
                          key={row.mat.id}
                          className={row.waste !== null && row.waste > 0 ? "bg-amber-50 dark:bg-amber-950/20" : ""}
                        >
                          <td className="px-4 py-2.5 font-medium">{row.mat.name}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{row.unit}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{row.actual.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {row.hasUnknown
                              ? <span className="text-muted-foreground">?</span>
                              : (row.theoretical ?? 0).toLocaleString()}
                          </td>
                          <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${
                            row.hasUnknown
                              ? "text-muted-foreground"
                              : row.waste !== null && row.waste > 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-emerald-600 dark:text-emerald-400"
                          }`}>
                            {row.hasUnknown
                              ? "?"
                              : row.waste !== null
                                ? row.waste.toLocaleString()
                                : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {row.hasUnknown
                              ? <span className="text-muted-foreground">?</span>
                              : row.wastePct !== null
                                ? `${row.wastePct.toFixed(1)}%`
                                : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {row.hasUnknown ? (
                              <Badge variant="secondary" className="text-xs">Inconnu</Badge>
                            ) : row.waste !== null && row.waste > 0 ? (
                              <Badge className="text-xs bg-amber-500 hover:bg-amber-500 text-white">Écart</Badge>
                            ) : (
                              <Badge className="text-xs bg-emerald-500 hover:bg-emerald-500 text-white">OK</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ③ Line chart — Waste % Trend */}
            <ChartCard title="Tendance Écart % — Toutes Matières">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex rounded-lg border overflow-hidden text-xs font-medium">
                  {(["month", "week"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setTrendMode(m)}
                      className={`px-3 py-1.5 transition-colors ${
                        trendMode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                      }`}
                    >
                      {m === "month" ? "Par mois" : "Par semaine"}
                    </button>
                  ))}
                </div>
              </div>
              {materialNames.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                  Pas assez de données pour afficher une tendance.
                </div>
              ) : (
                <ChartContainer
                  config={{}}
                  style={{ height: 300 }}
                  className="w-full"
                >
                  <LineChart data={trendData}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={40}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                    />
                    <ChartTooltip
                      formatter={(value: unknown, name: string) =>
                        value == null
                          ? ["Pas de données", name]
                          : [`${Number(value).toFixed(1)}%`, name]
                      }
                    />
                    <Legend />
                    {materialNames.map((name, i) => (
                      <Line
                        key={name}
                        type="monotone"
                        dataKey={name}
                        stroke={`var(--chart-${(i % 5) + 1})`}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls={false}
                      />
                    ))}
                  </LineChart>
                </ChartContainer>
              )}
            </ChartCard>

          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
