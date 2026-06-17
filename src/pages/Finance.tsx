import * as React from "react"
import { DollarSign, TrendingUp } from "lucide-react"
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
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

export function Finance() {
  const [rows, setRows] = React.useState<FinanceRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })

  async function load(month: string) {
    setLoading(true)
    const [y, m] = month.split("-").map(Number)
    const start = `${y}-${String(m).padStart(2, "0")}-01`
    const endMon = m === 12 ? 1 : m + 1
    const endYear = m === 12 ? y + 1 : y
    const end = `${endYear}-${String(endMon).padStart(2, "0")}-01`

    const { data } = await supabase
      .from("shipments")
      .select("*, suppliers(name), raw_materials(name, unit_of_measure)")
      .gte("date", start)
      .lt("date", end)
      .order("date", { ascending: false })

    setRows((data as FinanceRow[]) ?? [])
    setLoading(false)
  }

  React.useEffect(() => { load(currentMonth) }, [currentMonth])

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

  const totalMonthSpend = rows.reduce((acc, r) => acc + r.quantity * r.unit_price, 0)

  // Group by supplier for monthly breakdown
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

      {/* Month navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={prevMonth}>&larr;</Button>
        <span className="text-sm font-medium min-w-[160px] text-center">
          {formatMonth(currentMonth)}
        </span>
        <Button variant="outline" size="sm" onClick={nextMonth}>&rarr;</Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border bg-card px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <DollarSign className="size-3.5" />
                Total Spend
              </div>
              <div className="text-xl font-semibold tabular-nums">{formatCurrency(totalMonthSpend)}</div>
            </div>
            <div className="rounded-xl border bg-card px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <TrendingUp className="size-3.5" />
                Shipments
              </div>
              <div className="text-xl font-semibold">{rows.length}</div>
            </div>
            {bySupplier.length > 0 && (
              <div className="rounded-xl border bg-card px-4 py-3">
                <div className="text-xs text-muted-foreground mb-1">Top Supplier</div>
                <div className="text-sm font-semibold truncate">{bySupplier[0].name}</div>
                <div className="text-xs text-muted-foreground">{formatCurrency(bySupplier[0].total)}</div>
              </div>
            )}
          </div>

          {/* By supplier breakdown */}
          {bySupplier.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {bySupplier.map((s) => (
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

          {/* Shipment table */}
          {rows.length === 0 ? (
            <div className="rounded-xl border bg-card flex flex-col items-center justify-center py-16 text-center">
              <DollarSign className="size-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No purchases in {formatMonth(currentMonth)}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Record a shipment from the Suppliers page to see it here.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Invoice</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
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
  )
}
