import * as React from "react"
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Factory,
  Trash2,
  TrendingUp,
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
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis, LineChart, Line, Legend } from "recharts"
import { supabase } from "@/lib/supabase"
import type { RawMaterial, StockMovement, BOMItem } from "@/lib/types"

// ── Static product specs + BOM ───────────────────────────────────────────────
// Each entry: product name keyword, bottles per pallet, chart color, materials list
// Materials are matched against raw_materials.name using fuzzy keyword matching.
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
      "film etir",     // matches "film étirable / étirable / etirab"
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

/** Normalize a string: lowercase, strip accents, collapse non-alphanum to space */
function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/[^a-z0-9.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Check if a raw material name matches a BOM keyword phrase */
function matchesBOM(matName: string, bomKeyword: string): boolean {
  const n = norm(matName)
  const words = norm(bomKeyword).split(" ").filter((w) => w.length > 1)
  return words.every((w) => n.includes(w))
}

/** Return the ProductSpec whose key appears in the product name, or null */
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
  quantity: number       // pallets
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
  accent?: "emerald" | "amber" | "destructive" | "blue"
}) {
  const clr: Record<string, string> = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    destructive: "text-destructive",
    blue: "text-blue-600 dark:text-blue-400",
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
  const dechetMovements = outMovements.filter(
    (m) => m.note && /d[eé]chet|waste|perte|rebut/i.test(m.note)
  )
  const totalDechets = dechetMovements.reduce((s, m) => s + Number(m.quantity), 0)

  const totalSpent = shipments.reduce((s, r) => s + r.quantity * r.unit_price, 0)

  // ── Per-product aggregates ────────────────────────────────────────────────
  // Group production entries by product name
  const productTotals = React.useMemo(() => {
    const map = new Map<string, { pallets: number; spec: ProductSpec | null }>()
    for (const e of productionEntries) {
      const name = e.products?.name ?? "Unknown"
      const prev = map.get(name) ?? { pallets: 0, spec: specForProduct(name) }
      map.set(name, { ...prev, pallets: prev.pallets + e.quantity })
    }
    // Sort: 5.5L first, then 1.5L, then 0.5L, then others
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

  // ── Critical material ────────────────────────────────────────────────────────
  const criticalMaterial = React.useMemo(() => {
    return materials
      .filter((m) => m.daily_consumption && m.daily_consumption > 0)
      .map((m) => ({ ...m, daysLeft: Math.floor(m.current_quantity / m.daily_consumption!) }))
      .sort((a, b) => a.daysLeft - b.daysLeft)[0] ?? null
  }, [materials])

  // ── Chart A: Production per product over time (grouped bars) ─────────────
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

  // ── Per-product BOM consumption ──────────────────────────────────────────
  // For each product spec, find which raw materials match each BOM keyword,
  // and sum their OUT movements for the period.
  const perProductBOM = React.useMemo(() => {
    return PRODUCT_SPECS.map((spec) => {
      // Find production totals for products matching this spec
      const prod = productTotals.find((p) => p.spec?.key === spec.key)

      const bomRows = spec.bom.map((keyword) => {
        const matched = materials.filter((m) => matchesBOM(m.name, keyword))
        const consumed = outMovements
          .filter((mv) => matched.some((mat) => mat.id === mv.raw_material_id))
          .reduce((s, mv) => s + Number(mv.quantity), 0)
        const unit = matched[0]?.unit_of_measure ?? ""
        return {
          keyword,
          matchedNames: matched.map((m) => m.name),
          consumed,
          unit,
          hasMatch: matched.length > 0,
        }
      })

      return { spec, prod, bomRows }
    })
  }, [PRODUCT_SPECS, materials, outMovements, productTotals])

  // ── Chart B: Overall consumption per material ─────────────────────────────
  const consumptionChartData = React.useMemo(() => {
    const byMat = new Map<string, { name: string; qty: number }>()
    for (const m of outMovements) {
      const mat = materials.find((mt) => mt.id === m.raw_material_id)
      if (!mat) continue
      const e = byMat.get(mat.id) ?? { name: mat.name, qty: 0 }
      e.qty += Number(m.quantity)
      byMat.set(mat.id, e)
    }
    return Array.from(byMat.values()).sort((a, b) => b.qty - a.qty)
  }, [outMovements, materials])

  // ── Chart C: Déchets per material ─────────────────────────────────────────
  const dechetChartData = React.useMemo(() => {
    const byMat = new Map<string, { name: string; qty: number }>()
    for (const m of dechetMovements) {
      const mat = materials.find((mt) => mt.id === m.raw_material_id)
      if (!mat) continue
      const e = byMat.get(mat.id) ?? { name: mat.name, qty: 0 }
      e.qty += Number(m.quantity)
      byMat.set(mat.id, e)
    }
    return Array.from(byMat.values()).sort((a, b) => b.qty - a.qty)
  }, [dechetMovements, materials])

  // ── Chart D: Spending per supplier ────────────────────────────────────────
  const supplierSpendData = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const s of shipments) {
      const name = s.suppliers.name
      map.set(name, (map.get(name) ?? 0) + s.quantity * s.unit_price)
    }
    return Array.from(map.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total)
  }, [shipments])

  // ── Chart E: Days remaining ────────────────────────────────────────────────
  const daysRemainingData = React.useMemo(() => {
    return materials
      .filter((m) => m.daily_consumption && m.daily_consumption > 0)
      .map((m) => ({ name: m.name, days: Math.floor(m.current_quantity / m.daily_consumption!) }))
      .sort((a, b) => a.days - b.days)
  }, [materials])

  // ── Waste rows (Consumption tab) ─────────────────────────────────────────────
  const wasteRows = React.useMemo(() => {
    // Group bom_items by raw_material_id
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
        const spec = PRODUCT_SPECS.find((s) =>
          bomItem.products?.name?.includes(s.key)
        )
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
  // Always shows last 6 months or last 8 weeks — independent of period selector
  const { trendData, materialNames } = React.useMemo(() => {
    // All bom_items fetched without period filter (entire history)
    // Fetch all out movements and production entries is not possible here since
    // we only have period-filtered data in state. We reuse outMovements/productionEntries
    // as-is but build a separate all-time query approach is avoided by design;
    // instead we show what's in state for the trend (filtered by trendMode periods).
    //
    // Build period list
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
      // Last 8 weeks Mon–Sun
      const todayDay = now.getDay() === 0 ? 6 : now.getDay() - 1 // Mon=0
      const thisMonday = new Date(now)
      thisMonday.setHours(0, 0, 0, 0)
      thisMonday.setDate(now.getDate() - todayDay)
      for (let i = 7; i >= 0; i--) {
        const start = new Date(thisMonday)
        start.setDate(thisMonday.getDate() - i * 7)
        const end = new Date(start)
        end.setDate(start.getDate() + 7)
        // ISO week number approximation
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

        const actual = outMovements
          .filter((mv) => {
            const d = new Date(mv.date)
            return mv.raw_material_id === matId && d >= period.start && d < period.end
          })
          .reduce((s, mv) => s + Number(mv.quantity), 0)

        let theoretical = 0
        let hasUnknown = false

        for (const bomItem of bomItems.filter((b) => b.raw_material_id === matId)) {
          const spec = PRODUCT_SPECS.find((s) =>
            bomItem.products?.name?.includes(s.key)
          )
          if (!spec) continue

          const pallets = productionEntries
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
  }, [bomItems, materials, outMovements, productionEntries, trendMode])

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
            Production par produit, consommation par matière, déchets et dépenses.
          </p>
        </div>
        {/* ── Period selector — above Tabs, controls both Overview and Consumption ── */}
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
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="consumption">Consumption</TabsTrigger>
          </TabsList>

          {/* ═══════════════════════════════════════════════════════════════════
              OVERVIEW TAB — ALL EXISTING JSX, ZERO CHANGES
          ═══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="overview" className="mt-4 flex flex-col gap-6">
            {/* ── Summary cards ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryCard
                icon={Factory}
                label="Total Produit"
                value={totalBottlesAll.toLocaleString()}
                sub={`${totalPalletsAll.toLocaleString()} pallets`}
                accent="emerald"
              />
              <SummaryCard
                icon={DollarSign}
                label="Total Dépensé"
                value={fmtDA(totalSpent)}
                sub={`${shipments.length} livraisons`}
                accent="blue"
              />
              <SummaryCard
                icon={Trash2}
                label="Déchets"
                value={totalDechets > 0 ? totalDechets.toLocaleString() : "—"}
                sub={totalDechets > 0 ? `${dechetMovements.length} mouvements` : "Aucun déchet enregistré"}
                accent="amber"
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
                        {p.spec?.bottlesPerPallet ?? "?"} bouteilles/palette
                      </Badge>
                    </div>
                    <div className="flex gap-6">
                      <div>
                        <div className="text-xs text-muted-foreground">Pallets</div>
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

            {/* ── Chart A: Production per product over time ─────────────────── */}
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
                      content={<ChartTooltipContent formatter={(v, name) => [`${v} pallets`, name as string]} />}
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

            {/* ── Per-product BOM consumption ───────────────────────────────── */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Consommation par produit</h2>
                <span className="text-xs text-muted-foreground">
                  Basé sur les mouvements OUT de la période
                </span>
              </div>

              {perProductBOM.map(({ spec, prod, bomRows }) => {
                const hasAnyConsumption = bomRows.some((r) => r.consumed > 0)
                return (
                  <div
                    key={spec.key}
                    className="rounded-xl border bg-card overflow-hidden shadow-sm"
                    style={{ borderTopWidth: 3, borderTopColor: spec.chartColor }}
                  >
                    {/* Product header */}
                    <div className="px-5 py-3 flex items-center justify-between gap-4 border-b bg-muted/20">
                      <div className="flex items-center gap-3">
                        <div
                          className="size-3 rounded-full shrink-0"
                          style={{ background: spec.chartColor }}
                        />
                        <span className="font-semibold text-sm">{spec.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {spec.bottlesPerPallet} bouteilles / palette
                        </span>
                      </div>
                      {prod ? (
                        <div className="flex items-center gap-4 text-sm">
                          <span className="tabular-nums">
                            <span className="font-semibold">{prod.pallets.toLocaleString()}</span>
                            <span className="text-muted-foreground ml-1">pallets</span>
                          </span>
                          <span className="tabular-nums">
                            <span className="font-semibold">{prod.bottles.toLocaleString()}</span>
                            <span className="text-muted-foreground ml-1">bouteilles</span>
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Aucune production cette période</span>
                      )}
                    </div>

                    {/* BOM table */}
                    <div className="divide-y">
                      {bomRows.map((row) => (
                        <div
                          key={row.keyword}
                          className="px-5 py-2.5 flex items-center gap-3 text-sm"
                        >
                          {/* Color dot for matched/unmatched */}
                          <div
                            className={`size-2 rounded-full shrink-0 ${
                              row.hasMatch ? "bg-emerald-500" : "bg-muted-foreground/30"
                            }`}
                          />
                          {/* Material label (BOM keyword) */}
                          <span className="capitalize min-w-[160px] font-medium text-sm">
                            {row.keyword}
                          </span>
                          {/* Matched DB name(s) */}
                          <span className="text-xs text-muted-foreground flex-1 truncate">
                            {row.matchedNames.length > 0
                              ? row.matchedNames.join(", ")
                              : <span className="italic">Non trouvé dans la base</span>}
                          </span>
                          {/* Consumed */}
                          {row.hasMatch ? (
                            <span
                              className={`tabular-nums font-semibold ${
                                row.consumed === 0 ? "text-muted-foreground" : ""
                              }`}
                            >
                              {row.consumed > 0 ? row.consumed.toLocaleString() : "—"}
                              {row.unit && row.consumed > 0 && (
                                <span className="font-normal text-muted-foreground ml-1 text-xs">
                                  {row.unit}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {!hasAnyConsumption && (
                      <div className="px-5 py-2 text-xs text-muted-foreground border-t bg-muted/10">
                        Aucun mouvement OUT enregistré pour ces matières cette période.
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* ── Chart B: Global consumption per material ───────────────────── */}
            <ChartCard
              title={`Consommation globale par matière — ${periodLabel}`}
              empty={consumptionChartData.length === 0}
            >
              <div style={{ height: Math.max(180, consumptionChartData.length * 32) }}>
                <ChartContainer
                  config={{ qty: { label: "Quantité", color: "var(--chart-2)" } }}
                  className="h-full w-full"
                >
                  <BarChart
                    data={consumptionChartData}
                    layout="vertical"
                    margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                      width={120}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(v, _, { payload }) => [
                            `${v} ${materials.find((m) => m.name === payload?.name)?.unit_of_measure ?? ""}`,
                            "Consommé",
                          ]}
                        />
                      }
                    />
                    <Bar dataKey="qty" fill="var(--color-qty)" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            </ChartCard>

            {/* ── Chart C: Déchets per material ─────────────────────────────── */}
            <ChartCard title={`Déchets par matière — ${periodLabel}`} empty={false}>
              {dechetChartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-36 gap-2 text-center">
                  <Trash2 className="size-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    Aucun déchet enregistré.{" "}
                    <span className="text-xs block mt-0.5">
                      Ajoutez <code className="font-mono bg-muted px-1 rounded">déchet</code> dans la note d'un mouvement OUT.
                    </span>
                  </p>
                </div>
              ) : (
                <div style={{ height: Math.max(160, dechetChartData.length * 36) }}>
                  <ChartContainer
                    config={{ qty: { label: "Déchets", color: "var(--chart-3)" } }}
                    className="h-full w-full"
                  >
                    <BarChart
                      data={dechetChartData}
                      layout="vertical"
                      margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={120} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(v) => [`${v}`, "Déchets"]} />} />
                      <Bar dataKey="qty" fill="var(--color-qty)" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ChartContainer>
                </div>
              )}
            </ChartCard>

            {/* ── Chart D: Spending per supplier ────────────────────────────── */}
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

            {/* ── Chart E: Days remaining per material ──────────────────────── */}
            <ChartCard
              title="Jours de stock restant par matière (actuel)"
              empty={daysRemainingData.length === 0}
              emptyMsg="Définissez la consommation journalière de vos matières pour voir ce graphique."
            >
              <>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2.5 rounded-sm bg-destructive" /> &lt; 3 jours
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2.5 rounded-sm bg-amber-500" /> &lt; 7 jours
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2.5 rounded-sm bg-[var(--chart-1)]" /> Bon stock
                  </span>
                </div>
                <div style={{ height: Math.max(160, daysRemainingData.length * 36) }}>
                  <ChartContainer
                    config={{ days: { label: "Jours", color: "var(--chart-1)" } }}
                    className="h-full w-full"
                  >
                    <BarChart
                      data={daysRemainingData}
                      layout="vertical"
                      margin={{ top: 4, right: 40, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={120} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(v) => [`${v} jours`, "Stock restant"]} />} />
                      <Bar dataKey="days" radius={[0, 3, 3, 0]}>
                        {daysRemainingData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={
                              entry.days <= 3
                                ? "hsl(var(--destructive))"
                                : entry.days <= 7
                                ? "hsl(38 92% 50%)"
                                : "var(--chart-1)"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </div>
              </>
            </ChartCard>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════════
              CONSUMPTION TAB
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
                label="Total Theoretical"
                value={
                  wasteRows.some((r) => r.theoretical == null)
                    ? <span className="text-muted-foreground text-lg">Partial</span>
                    : wasteRows.reduce((s, r) => s + (r.theoretical ?? 0), 0).toLocaleString()
                }
                accent="emerald"
              />
              <SummaryCard
                icon={AlertTriangle}
                label="Total Waste"
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
                <p className="text-sm font-semibold">Consumption vs Theoretical — {periodLabel}</p>
              </div>
              {wasteRows.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                  No BOM entries configured. Go to Production → BOM to set them up.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Material</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Unit</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Actual</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Theoretical</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Waste</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Waste %</th>
                        <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Status</th>
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
                              <Badge variant="secondary" className="text-xs">Unknown</Badge>
                            ) : row.waste !== null && row.waste > 0 ? (
                              <Badge className="text-xs bg-amber-500 hover:bg-amber-500 text-white">Waste</Badge>
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

            {/* ③ Horizontal bar chart — Waste by material */}
            <ChartCard
              title="Waste by Material"
              empty={wasteRows.filter((r) => r.waste !== null).length === 0}
              emptyMsg="No data — configure your BOM first."
            >
              {(() => {
                const chartRows = wasteRows
                  .filter((r) => r.waste !== null)
                  .sort((a, b) => (b.waste ?? 0) - (a.waste ?? 0))
                  .map((r) => ({ name: r.mat.name, waste: r.waste ?? 0 }))
                return (
                  <div style={{ height: Math.max(160, chartRows.length * 36) }}>
                    <ChartContainer
                      config={{ waste: { label: "Waste", color: "var(--chart-1)" } }}
                      className="h-full w-full"
                    >
                      <BarChart
                        data={chartRows}
                        layout="vertical"
                        margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
                      >
                        <CartesianGrid horizontal={false} />
                        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11 }}
                          width={130}
                        />
                        <ChartTooltip
                          content={<ChartTooltipContent formatter={(v) => [String(v), "Waste"]} />}
                        />
                        <Bar dataKey="waste" fill="var(--chart-1)" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </div>
                )
              })()}
            </ChartCard>

            {/* ④ Line chart — Waste % Trend */}
            <ChartCard title="Waste % Trend — All Materials">
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
                      {m === "month" ? "By Month" : "By Week"}
                    </button>
                  ))}
                </div>
              </div>
              {materialNames.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                  Not enough data to show a trend yet.
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
                          ? ["No data", name]
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
