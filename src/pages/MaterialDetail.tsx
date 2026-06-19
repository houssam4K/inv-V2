import * as React from "react"
import {
  ArrowDownCircle,
  ArrowLeft,
  ArrowUpCircle,
  CalendarDays,
  Clock,
  Edit2,
  FileText,
  Package,
  TrendingDown,
  Truck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import { supabase } from "@/lib/supabase"
import { type RawMaterial, type StockMovement } from "@/lib/types"

interface Props {
  material: RawMaterial
  onBack: () => void
  onUpdated: (updated: RawMaterial) => void
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-DZ", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit" })
}

function monthKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function fmtMonth(mk: string) {
  const [y, m] = mk.split("-").map(Number)
  return new Date(y, m - 1).toLocaleDateString("fr-DZ", { year: "numeric", month: "long" })
}

// ---------- Forecast chart ----------

const CHART_CONFIG = {
  stock: { label: "Stock", color: "var(--chart-1)" },
}

function ForecastChart({ currentStock, dailyConsumption, unit }: {
  currentStock: number
  dailyConsumption: number
  unit: string
}) {
  const data = Array.from({ length: 8 }, (_, i) => ({
    day: i === 0 ? "Today" : `J+${i}`,
    stock: Math.max(0, currentStock - dailyConsumption * i),
  }))

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">7-Day Stock Forecast</p>
        <span className="text-xs text-muted-foreground">−{dailyConsumption} {unit}/day</span>
      </div>
      <ChartContainer config={CHART_CONFIG} className="min-h-[160px] w-full">
        <BarChart data={data} margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <YAxis hide />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Bar dataKey="stock" fill="var(--color-stock)" radius={[4, 4, 0, 0]}>
            <LabelList
              dataKey="stock"
              position="top"
              style={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  )
}

// ---------- Edit daily consumption ----------

function EditDailyConsumption({ material, onSaved }: {
  material: RawMaterial
  onSaved: (updated: RawMaterial) => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [value, setValue] = React.useState(material.daily_consumption?.toString() ?? "")
  const [saving, setSaving] = React.useState(false)

  async function save() {
    const dc = value.trim() !== "" ? parseFloat(value) : null
    if (dc !== null && (isNaN(dc) || dc < 0)) return
    setSaving(true)
    const { error } = await supabase
      .from("raw_materials")
      .update({ daily_consumption: dc })
      .eq("id", material.id)
    setSaving(false)
    if (!error) {
      setEditing(false)
      onSaved({ ...material, daily_consumption: dc })
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min="0"
          step="any"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-7 w-28 text-sm tabular-nums"
          autoFocus
        />
        <span className="text-xs text-muted-foreground">{material.unit_of_measure}/day</span>
        <Button size="sm" className="h-7 text-xs px-2.5" onClick={save} disabled={saving}>
          {saving ? "..." : "Save"}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm tabular-nums font-medium">
        {material.daily_consumption != null
          ? `${material.daily_consumption} ${material.unit_of_measure}/day`
          : <span className="text-muted-foreground text-xs">Not set</span>}
      </span>
      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditing(true)}>
        <Edit2 className="size-3" />
      </Button>
    </div>
  )
}

// ---------- Main page ----------

interface MovementWithBalance extends StockMovement {
  balanceAfter: number
}

export function MaterialDetail({ material: initialMaterial, onBack, onUpdated }: Props) {
  const [material, setMaterial] = React.useState(initialMaterial)
  const [allMovements, setAllMovements] = React.useState<MovementWithBalance[]>([])
  const [loading, setLoading] = React.useState(true)
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })

  React.useEffect(() => {
    setMaterial(initialMaterial)
  }, [initialMaterial.id])

  async function loadMovements() {
    setLoading(true)
    const { data } = await supabase
      .from("stock_movements")
      .select("*")
      .eq("raw_material_id", material.id)
      .order("date", { ascending: true })

    const movements = (data as StockMovement[]) ?? []

    // Compute running balance forward from 0
    let balance = 0
    const withBalance: MovementWithBalance[] = movements.map((m) => {
      if (m.movement_type === "IN") balance += m.quantity
      else balance -= m.quantity
      return { ...m, balanceAfter: balance }
    })

    setAllMovements(withBalance)
    setLoading(false)
  }

  React.useEffect(() => { loadMovements() }, [material.id])

  // Available months from all movements
  const availableMonths = React.useMemo(() => {
    const set = new Set<string>()
    for (const m of allMovements) set.add(monthKey(m.date))
    const sorted = Array.from(set).sort((a, b) => b.localeCompare(a))
    return sorted
  }, [allMovements])

  // Ensure currentMonth is valid
  React.useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(currentMonth)) {
      setCurrentMonth(availableMonths[0])
    }
  }, [availableMonths])

  // Movements in current month
  const monthMovements = React.useMemo(
    () => allMovements.filter((m) => monthKey(m.date) === currentMonth),
    [allMovements, currentMonth]
  )

  // Stock at start of selected month (balance before first movement of month)
  const stockAtStartOfMonth = React.useMemo(() => {
    const idx = allMovements.findIndex((m) => monthKey(m.date) === currentMonth)
    if (idx === 0) return 0
    if (idx === -1) return allMovements[allMovements.length - 1]?.balanceAfter ?? 0
    return allMovements[idx - 1].balanceAfter
  }, [allMovements, currentMonth])

  // Group movements by day for the table display
  const byDay = React.useMemo(() => {
    const map = new Map<string, MovementWithBalance[]>()
    for (const m of monthMovements) {
      const key = fmtDate(m.date)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(m)
    }
    return Array.from(map.entries())
  }, [monthMovements])

  // Month stats
  const totalIn = monthMovements.filter((m) => m.movement_type === "IN").reduce((a, m) => a + m.quantity, 0)
  const totalOut = monthMovements.filter((m) => m.movement_type === "OUT").reduce((a, m) => a + m.quantity, 0)

  // Jours restants
  const joursRestants = material.daily_consumption && material.daily_consumption > 0
    ? Math.floor(material.current_quantity / material.daily_consumption)
    : null

  function handleUpdated(updated: RawMaterial) {
    setMaterial(updated)
    onUpdated(updated)
  }

  function prevMonth() {
    const [y, m] = currentMonth.split("-").map(Number)
    const pm = m === 1 ? 12 : m - 1
    const py = m === 1 ? y - 1 : y
    setCurrentMonth(`${py}-${String(pm).padStart(2, "0")}`)
  }

  function nextMonth() {
    const [y, m] = currentMonth.split("-").map(Number)
    const nm = m === 12 ? 1 : m + 1
    const ny = m === 12 ? y + 1 : y
    setCurrentMonth(`${ny}-${String(nm).padStart(2, "0")}`)
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="-ml-1 mt-0.5 shrink-0">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Package className="size-6 text-muted-foreground" />
            {material.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{material.unit_of_measure}</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground mb-1">Current Stock</div>
          <div className="text-xl font-semibold tabular-nums">{material.current_quantity}</div>
          <div className="text-xs text-muted-foreground">{material.unit_of_measure}</div>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <TrendingDown className="size-3" />
            Consommation/jour
          </div>
          <EditDailyConsumption material={material} onSaved={handleUpdated} />
        </div>
        {joursRestants !== null && (
          <div className={`rounded-xl border px-4 py-3 ${joursRestants <= 3 ? "bg-destructive/10 border-destructive/30" : joursRestants <= 7 ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900" : "bg-card"}`}>
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <CalendarDays className="size-3" />
              Jours restants
            </div>
            <div className={`text-xl font-semibold tabular-nums ${joursRestants <= 3 ? "text-destructive" : joursRestants <= 7 ? "text-amber-700 dark:text-amber-400" : ""}`}>
              {joursRestants}
            </div>
            <div className="text-xs text-muted-foreground">days</div>
          </div>
        )}
        <div className="rounded-xl border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Clock className="size-3" />
            Total movements
          </div>
          <div className="text-xl font-semibold">{allMovements.length}</div>
        </div>
      </div>

      {/* Forecast chart */}
      {material.daily_consumption != null && material.daily_consumption > 0 && (
        <ForecastChart
          currentStock={material.current_quantity}
          dailyConsumption={material.daily_consumption}
          unit={material.unit_of_measure}
        />
      )}

      <Separator />

      {/* Month navigation */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold">Movement History</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth}>&larr;</Button>
          <span className="text-sm font-medium min-w-[160px] text-center">
            {fmtMonth(currentMonth)}
          </span>
          <Button variant="outline" size="sm" onClick={nextMonth}>&rarr;</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <>
          {/* Month summary row */}
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="rounded-lg border bg-card px-3 py-2 flex items-center gap-2">
              <span className="text-muted-foreground text-xs">Stock at start</span>
              <span className="font-semibold tabular-nums">{stockAtStartOfMonth}</span>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2 flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <ArrowUpCircle className="size-3.5" />
              <span className="tabular-nums font-medium">+{totalIn}</span>
              <span className="text-xs text-muted-foreground">received</span>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2 flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <ArrowDownCircle className="size-3.5" />
              <span className="tabular-nums font-medium">−{totalOut}</span>
              <span className="text-xs text-muted-foreground">consumed</span>
            </div>
          </div>

          {/* Movements table */}
          {monthMovements.length === 0 ? (
            <div className="rounded-xl border bg-card flex flex-col items-center justify-center py-16 text-center">
              <CalendarDays className="size-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No movements in {fmtMonth(currentMonth)}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Stock After</TableHead>
                    <TableHead>Source / Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Group by day */}
                  {byDay.map(([day, items]) => (
                    <React.Fragment key={day}>
                      {/* Day separator row */}
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={5} className="py-1.5">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {day}
                          </span>
                        </TableCell>
                      </TableRow>
                      {items.map((mov) => {
                        const isIn = mov.movement_type === "IN"
                        return (
                          <TableRow key={mov.id}>
                            <TableCell className="text-sm text-muted-foreground">
                              {fmtTime(mov.date)}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center gap-1 text-xs font-medium ${isIn ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                                {isIn
                                  ? <ArrowUpCircle className="size-3.5" />
                                  : <ArrowDownCircle className="size-3.5" />}
                                {isIn ? "Received" : "Consumed"}
                              </span>
                            </TableCell>
                            <TableCell className={`text-right tabular-nums font-semibold ${isIn ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                              {isIn ? "+" : "−"}{mov.quantity}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium text-sm">
                              {mov.balanceAfter}
                              <span className="text-muted-foreground font-normal ml-1 text-xs">{material.unit_of_measure}</span>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {mov.supplier_name && (
                                  <Badge variant="secondary" className="text-xs font-normal gap-1 shrink-0">
                                    <Truck className="size-3" />
                                    {mov.supplier_name}
                                  </Badge>
                                )}
                                {mov.invoice_number && (
                                  <Badge variant="outline" className="text-xs font-mono font-normal gap-1 shrink-0">
                                    <FileText className="size-3" />
                                    {mov.invoice_number}
                                  </Badge>
                                )}
                                {mov.note && (
                                  <span className="text-xs text-muted-foreground truncate">
                                    {mov.note}
                                  </span>
                                )}
                                {!mov.supplier_name && !mov.invoice_number && !mov.note && (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {/* End of day stock */}
                      <TableRow className="bg-muted/10 hover:bg-muted/10">
                        <TableCell colSpan={3} className="py-1">
                          <span className="text-xs text-muted-foreground pl-2">End of day</span>
                        </TableCell>
                        <TableCell className="text-right py-1">
                          <span className="text-xs font-semibold tabular-nums">
                            {items[items.length - 1].balanceAfter}
                            <span className="font-normal text-muted-foreground ml-1">{material.unit_of_measure}</span>
                          </span>
                        </TableCell>
                        <TableCell className="py-1" />
                      </TableRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
