import * as React from "react"
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, DollarSign, FileDown, TrendingDown, TrendingUp, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { supabase } from "@/lib/supabase"
import { exportFinancePDF } from "@/lib/pdf"

interface FinanceRow {
  id: string
  date: string
  quantity: number
  unit_price: number
  invoice_number: string | null
  note: string | null
  suppliers: { name: string }
  raw_materials: { name: string; unit_of_measure: string }
}

// Bug fix #6: parse date parts manually to avoid UTC-midnight timezone shift
function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatCurrency(n: number) {
  return n.toLocaleString() + " DA"
}

function formatMonth(month: string) {
  const [y, m] = month.split("-").map(Number)
  return new Date(y, m - 1).toLocaleDateString(undefined, { year: "numeric", month: "long" })
}

function getMonthBounds(month: string) {
  const [y, m] = month.split("-").map(Number)
  const start = `${y}-${String(m).padStart(2, "0")}-01`
  const endMon = m === 12 ? 1 : m + 1
  const endYear = m === 12 ? y + 1 : y
  const end = `${endYear}-${String(endMon).padStart(2, "0")}-01`
  return { start, end }
}

function shiftMonth(month: string, delta: -1 | 1): string {
  const [y, m] = month.split("-").map(Number)
  let nm = m + delta
  let ny = y
  if (nm < 1) { nm = 12; ny-- }
  if (nm > 12) { nm = 1; ny++ }
  return `${ny}-${String(nm).padStart(2, "0")}`
}

type SortKey = "date" | "supplier" | "total"
type SortDir = "asc" | "desc"

const ROW_LIMIT = 4999

export function Finance() {
  // ── core data state ────────────────────────────────────────────────────────
  const [rows, setRows] = React.useState<FinanceRow[]>([])
  // Bug fix #6 (smooth loading): separate isFetching (subsequent loads) from loading (first mount)
  const [loading, setLoading] = React.useState(true)
  const [isFetching, setIsFetching] = React.useState(false)
  const [queryError, setQueryError] = React.useState<string | null>(null)
  const [truncated, setTruncated] = React.useState(false)

  // Bug fix #1: request ordering guard
  const loadIdRef = React.useRef(0)

  // ── prev-month trend state ─────────────────────────────────────────────────
  const [prevMonthSpend, setPrevMonthSpend] = React.useState<number | null>(null)

  // ── export state ───────────────────────────────────────────────────────────
  const [exporting, setExporting] = React.useState(false)
  const [exportError, setExportError] = React.useState<string | null>(null)

  // ── month navigation ────────────────────────────────────────────────────────
  const todayMonth = React.useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  }, [])
  const [currentMonth, setCurrentMonth] = React.useState(todayMonth)

  // ── filter / sort state (display-layer only, never touches raw `rows`) ─────
  const [search, setSearch] = React.useState("")
  const [filterSupplier, setFilterSupplier] = React.useState("")
  const [filterMaterial, setFilterMaterial] = React.useState("")
  const [sortKey, setSortKey] = React.useState<SortKey>("date")
  const [sortDir, setSortDir] = React.useState<SortDir>("desc")

  // ── load current month ─────────────────────────────────────────────────────
  async function load(month: string) {
    // Bug fix #1: increment request id; capture at call time
    const id = ++loadIdRef.current

    if (loading) {
      // first mount — keep full skeleton
    } else {
      setIsFetching(true)
    }
    setQueryError(null)
    setTruncated(false)

    const { start, end } = getMonthBounds(month)

    // Bug fix #3: explicit range to avoid silent row-cap truncation
    const { data, error } = await supabase
      .from("shipments")
      .select("*, suppliers(name), raw_materials(name, unit_of_measure)")
      .gte("date", start)
      .lt("date", end)
      .order("date", { ascending: false })
      .range(0, ROW_LIMIT)

    // Bug fix #1: stale-response guard
    if (id !== loadIdRef.current) return

    // Bug fix #2: surface query errors
    if (error) {
      console.error("[Finance] shipments query error:", error)
      setQueryError(error.message)
      setLoading(false)
      setIsFetching(false)
      return
    }

    const fetched = (data as FinanceRow[]) ?? []

    // Bug fix #3: warn if we hit the limit exactly (results may be truncated)
    if (fetched.length === ROW_LIMIT + 1 || fetched.length === ROW_LIMIT) {
      setTruncated(fetched.length === ROW_LIMIT)
    }

    setRows(fetched)
    setLoading(false)
    setIsFetching(false)
  }

  // ── load previous month total (separate query — does not affect current month data) ──
  async function loadPrevMonthSpend(month: string) {
    const prevMonth = shiftMonth(month, -1)
    const { start, end } = getMonthBounds(prevMonth)
    const { data } = await supabase
      .from("shipments")
      .select("quantity, unit_price")
      .gte("date", start)
      .lt("date", end)
      .range(0, ROW_LIMIT)
    if (!data) { setPrevMonthSpend(null); return }
    const total = (data as { quantity: number; unit_price: number }[])
      .reduce((acc, r) => acc + r.quantity * r.unit_price, 0)
    setPrevMonthSpend(total)
  }

  React.useEffect(() => {
    load(currentMonth)
    loadPrevMonthSpend(currentMonth)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth])

  // ── month navigation helpers ───────────────────────────────────────────────
  function prevMonth() { setCurrentMonth(m => shiftMonth(m, -1)) }
  function nextMonth() { setCurrentMonth(m => shiftMonth(m, 1)) }
  function goToday()   { setCurrentMonth(todayMonth) }

  // ── base totals (always from full `rows`, unaffected by filters) ───────────
  const totalMonthSpend = rows.reduce((acc, r) => acc + r.quantity * r.unit_price, 0)

  const bySupplier = React.useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>()
    for (const r of rows) {
      const name = r.suppliers.name
      const total = r.quantity * r.unit_price
      if (!map.has(name)) map.set(name, { name, total: 0, count: 0 })
      const entry = map.get(name)!
      entry.total += total
      entry.count++
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [rows])

  // ── distinct filter options derived from full rows ──────────────────────────
  const supplierOptions = React.useMemo(
    () => [...new Set(rows.map(r => r.suppliers.name))].sort(),
    [rows]
  )
  const materialOptions = React.useMemo(
    () => [...new Set(rows.map(r => r.raw_materials.name))].sort(),
    [rows]
  )

  // ── display-layer filtered + sorted rows ────────────────────────────────────
  const filteredRows = React.useMemo(() => {
    let result = rows
    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter(
        r =>
          r.suppliers.name.toLowerCase().includes(q) ||
          r.raw_materials.name.toLowerCase().includes(q)
      )
    }
    if (filterSupplier) {
      result = result.filter(r => r.suppliers.name === filterSupplier)
    }
    if (filterMaterial) {
      result = result.filter(r => r.raw_materials.name === filterMaterial)
    }
    return [...result].sort((a, b) => {
      let cmp = 0
      if (sortKey === "date") cmp = a.date.localeCompare(b.date)
      else if (sortKey === "supplier") cmp = a.suppliers.name.localeCompare(b.suppliers.name)
      else if (sortKey === "total") cmp = (a.quantity * a.unit_price) - (b.quantity * b.unit_price)
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [rows, search, filterSupplier, filterMaterial, sortKey, sortDir])

  // Filter-view summary cards (driven by filteredRows for display, NOT changing base totals)
  const isFiltered = !!search.trim() || !!filterSupplier || !!filterMaterial
  const filteredSpend = React.useMemo(
    () => filteredRows.reduce((acc, r) => acc + r.quantity * r.unit_price, 0),
    [filteredRows]
  )
  const filteredBySupplier = React.useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>()
    for (const r of filteredRows) {
      const name = r.suppliers.name
      const total = r.quantity * r.unit_price
      if (!map.has(name)) map.set(name, { name, total: 0, count: 0 })
      const entry = map.get(name)!
      entry.total += total
      entry.count++
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [filteredRows])

  // ── sort toggle helper ─────────────────────────────────────────────────────
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="ml-1 size-3 opacity-40 inline" />
    return sortDir === "asc"
      ? <ArrowUp className="ml-1 size-3 inline" />
      : <ArrowDown className="ml-1 size-3 inline" />
  }

  // ── clear all filters ──────────────────────────────────────────────────────
  function clearFilters() {
    setSearch("")
    setFilterSupplier("")
    setFilterMaterial("")
  }

  // ── export (bug fix #4: catch errors) ─────────────────────────────────────
  function handleExport() {
    setExporting(true)
    setExportError(null)
    try {
      exportFinancePDF(rows, currentMonth, bySupplier)
    } catch (err) {
      console.error("[Finance] export failed:", err)
      setExportError("Export failed — try again")
    } finally {
      setExporting(false)
    }
  }

  // ── trend badge ────────────────────────────────────────────────────────────
  function TrendBadge() {
    if (prevMonthSpend === null) return null
    if (prevMonthSpend === 0 && totalMonthSpend === 0) return null
    if (prevMonthSpend === 0) return <span className="text-xs text-muted-foreground ml-1">(new)</span>
    const pct = ((totalMonthSpend - prevMonthSpend) / prevMonthSpend) * 100
    const up = pct >= 0
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-xs font-medium ml-1 ${up ? "text-red-500" : "text-green-600"}`}
        title={`Previous month: ${formatCurrency(prevMonthSpend)}`}
      >
        {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
        {up ? "+" : ""}{pct.toFixed(1)}%
      </span>
    )
  }

  // decide which supplier/material breakdown to show
  const displayBySupplier = isFiltered ? filteredBySupplier : bySupplier
  const displaySpend      = isFiltered ? filteredSpend      : totalMonthSpend
  const displayCount      = isFiltered ? filteredRows.length : rows.length

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight">Finance</h1>
          <p className="text-muted-foreground mt-1">
            Track all purchase costs and supplier spending.
          </p>
        </div>
      </div>

      {/* Month navigation + export */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Bug fix #5: aria-labels on nav buttons */}
          <Button variant="outline" size="sm" onClick={prevMonth} aria-label="Previous month">
            &larr;
          </Button>

          {/* Feature: jump-to-month input */}
          <input
            type="month"
            value={currentMonth}
            onChange={e => e.target.value && setCurrentMonth(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Jump to month"
          />

          <Button variant="outline" size="sm" onClick={nextMonth} aria-label="Next month">
            &rarr;
          </Button>

          {/* Feature: Today button */}
          {currentMonth !== todayMonth && (
            <Button variant="ghost" size="sm" onClick={goToday} className="text-xs">
              Today
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {exportError && (
            <span className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="size-3" /> {exportError}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={loading || rows.length === 0 || exporting}
            className="gap-1.5"
          >
            <FileDown className="size-3.5" />
            {exporting ? "Exporting..." : "Export PDF"}
          </Button>
        </div>
      </div>

      {/* Bug fix #3: truncation warning */}
      {truncated && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-400/40 bg-yellow-50/10 px-3 py-2 text-xs text-yellow-600">
          <AlertCircle className="size-3.5 shrink-0" />
          Results may be truncated — this month has more than {ROW_LIMIT.toLocaleString()} shipment rows. Totals shown may be understated.
        </div>
      )}

      {/* Bug fix #2: inline query error state */}
      {queryError && !loading && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>Failed to load shipments: {queryError}</span>
        </div>
      )}

      {/* Feature (smooth loading): full skeleton only on first load; fade existing data while fetching */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <div className={isFetching ? "opacity-50 pointer-events-none transition-opacity duration-150" : "transition-opacity duration-150"}>
          {!queryError && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                <div className="rounded-xl border bg-card px-4 py-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <DollarSign className="size-3.5" />
                    {isFiltered ? "Filtered Spend" : "Total Spend"}
                  </div>
                  <div className="text-xl font-semibold tabular-nums">
                    {formatCurrency(displaySpend)}
                    {!isFiltered && <TrendBadge />}
                  </div>
                  {isFiltered && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Full month: {formatCurrency(totalMonthSpend)}
                    </div>
                  )}
                </div>
                <div className="rounded-xl border bg-card px-4 py-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <TrendingUp className="size-3.5" />
                    {isFiltered ? "Filtered Shipments" : "Shipments"}
                  </div>
                  <div className="text-xl font-semibold">{displayCount}</div>
                  {isFiltered && (
                    <div className="text-xs text-muted-foreground mt-0.5">Full month: {rows.length}</div>
                  )}
                </div>
                {displayBySupplier.length > 0 && (
                  <div className="rounded-xl border bg-card px-4 py-3">
                    <div className="text-xs text-muted-foreground mb-1">Top Supplier</div>
                    <div className="text-sm font-semibold truncate">{displayBySupplier[0].name}</div>
                    <div className="text-xs text-muted-foreground">{formatCurrency(displayBySupplier[0].total)}</div>
                  </div>
                )}
              </div>

              {/* By supplier breakdown */}
              {displayBySupplier.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {displayBySupplier.map((s) => (
                    <div key={s.name} className="rounded-lg border bg-card px-3 py-2 flex items-center gap-3">
                      <span className="text-sm font-medium">{s.name}</span>
                      <Badge variant="secondary" className="tabular-nums text-xs">
                        {formatCurrency(s.total)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{s.count} shipment{s.count !== 1 ? "s" : ""}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Feature: search + filter controls */}
              {rows.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Search supplier or material…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring flex-1 min-w-[180px]"
                    aria-label="Search by supplier or material name"
                  />
                  <select
                    value={filterSupplier}
                    onChange={e => setFilterSupplier(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    aria-label="Filter by supplier"
                  >
                    <option value="">All suppliers</option>
                    {supplierOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select
                    value={filterMaterial}
                    onChange={e => setFilterMaterial(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    aria-label="Filter by material"
                  >
                    <option value="">All materials</option>
                    {materialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {isFiltered && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs h-8">
                      <X className="size-3" /> Clear filters
                    </Button>
                  )}
                </div>
              )}

              {/* Shipment table */}
              {rows.length === 0 ? (
                <div className="rounded-xl border bg-card flex flex-col items-center justify-center py-16 text-center">
                  <DollarSign className="size-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No purchases in {formatMonth(currentMonth)}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Record a shipment from the Suppliers page to see it here.
                  </p>
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="rounded-xl border bg-card flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm font-medium text-muted-foreground">No rows match the current filters.</p>
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-2 text-xs gap-1">
                    <X className="size-3" /> Clear filters
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border bg-card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {/* Feature: sortable columns */}
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => toggleSort("date")}
                        >
                          Date <SortIcon col="date" />
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => toggleSort("supplier")}
                        >
                          Supplier <SortIcon col="supplier" />
                        </TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => toggleSort("total")}
                        >
                          Total <SortIcon col="total" />
                        </TableHead>
                        <TableHead>Invoice</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm">{formatDate(r.date)}</TableCell>
                          <TableCell className="text-sm font-medium">{r.suppliers.name}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm">{r.raw_materials.name}</span>
                              <span className="text-xs text-muted-foreground">{r.raw_materials.unit_of_measure}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{r.quantity}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                            {r.unit_price > 0 ? formatCurrency(r.unit_price) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {r.unit_price > 0 ? formatCurrency(r.quantity * r.unit_price) : "—"}
                          </TableCell>
                          <TableCell>
                            {r.invoice_number ? (
                              <Badge variant="outline" className="text-xs font-mono">
                                {r.invoice_number}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
