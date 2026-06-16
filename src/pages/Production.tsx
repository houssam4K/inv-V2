import * as React from "react"
import { Factory } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { supabase } from "@/lib/supabase"
import type { Product, Team, ProductionEntry } from "@/lib/types"

interface ProductWithLine extends Product {
  production_lines: { name: string }
}

interface TeamWithLine extends Team {
  production_lines: { name: string }
}

interface EntryRow {
  team_id: string
  team_name: string
  entries: Map<string, number>
  total: number
}

export function Production() {
  const [products, setProducts] = React.useState<ProductWithLine[]>([])
  const [teams, setTeams] = React.useState<TeamWithLine[]>([])
  const [entries, setEntries] = React.useState<ProductionEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeProduct, setActiveProduct] = React.useState<string | null>(null)
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })

  // Entry dialog state
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [dialogDate, setDialogDate] = React.useState("")
  const [dialogQuantities, setDialogQuantities] = React.useState<Record<string, string>>({})
  const [dialogError, setDialogError] = React.useState("")
  const [dialogLoading, setDialogLoading] = React.useState(false)

  async function loadAll() {
    const [prodRes, teamRes] = await Promise.all([
      supabase.from("products").select("*, production_lines(name)").order("name"),
      supabase.from("teams").select("*, production_lines(name)").order("name"),
    ])
    const prods = (prodRes.data as ProductWithLine[]) ?? []
    const teamList = (teamRes.data as TeamWithLine[]) ?? []
    setProducts(prods)
    setTeams(teamList)
    if (prods.length > 0 && !activeProduct) {
      setActiveProduct(prods[0].id)
    }
    return { prods, teamList }
  }

  async function loadEntries(productIds: string[], month: string) {
    if (productIds.length === 0) return
    const [year, mon] = month.split("-").map(Number)
    const start = `${year}-${String(mon).padStart(2, "0")}-01`
    const endMon = mon === 12 ? 1 : mon + 1
    const endYear = mon === 12 ? year + 1 : year
    const end = `${endYear}-${String(endMon).padStart(2, "0")}-01`

    const { data } = await supabase
      .from("production_entries")
      .select("*")
      .in("product_id", productIds)
      .gte("date", start)
      .lt("date", end)
      .order("date")

    setEntries((data as ProductionEntry[]) ?? [])
  }

  React.useEffect(() => {
    let cancelled = false
    async function init() {
      setLoading(true)
      const { prods } = await loadAll()
      if (!cancelled && prods.length > 0) {
        await loadEntries(
          prods.map((p) => p.id),
          currentMonth
        )
      }
      if (!cancelled) setLoading(false)
    }
    init()
    return () => { cancelled = true }
  }, [])

  React.useEffect(() => {
    if (products.length > 0) {
      loadEntries(
        products.map((p) => p.id),
        currentMonth
      )
    }
  }, [currentMonth, products.length])

  function getProductTeams(productId: string): TeamWithLine[] {
    const product = products.find((p) => p.id === productId)
    if (!product) return []
    return teams.filter((t) => t.line_id === product.line_id)
  }

  function buildMonthGrid(productId: string) {
    const productTeams = getProductTeams(productId)
    const [year, mon] = currentMonth.split("-").map(Number)
    const daysInMonth = new Date(year, mon, 0).getDate()
    const days: string[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(`${year}-${String(mon).padStart(2, "0")}-${String(d).padStart(2, "0")}`)
    }

    const productEntries = entries.filter((e) => e.product_id === productId)

    const rows: EntryRow[] = productTeams.map((team) => {
      const teamEntries = new Map<string, number>()
      let total = 0
      for (const e of productEntries) {
        if (e.team_id === team.id) {
          teamEntries.set(e.date, e.quantity)
          total += e.quantity
        }
      }
      return { team_id: team.id, team_name: team.name, entries: teamEntries, total }
    })

    const dailyTotals = days.map((day) => {
      let sum = 0
      for (const row of rows) {
        sum += row.entries.get(day) ?? 0
      }
      return sum
    })

    const grandTotal = rows.reduce((acc, r) => acc + r.total, 0)

    return { days, rows, dailyTotals, grandTotal }
  }

  function openEntryDialog() {
    const today = new Date()
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
    setDialogDate(dateStr)
    setDialogError("")
    const productTeams = getProductTeams(activeProduct!)
    const qtys: Record<string, string> = {}
    for (const t of productTeams) {
      const existing = entries.find(
        (e) => e.product_id === activeProduct && e.team_id === t.id && e.date === dateStr
      )
      qtys[t.id] = existing ? String(existing.quantity) : ""
    }
    setDialogQuantities(qtys)
    setDialogOpen(true)
  }

  async function handleEntrySubmit(e: React.FormEvent) {
    e.preventDefault()
    setDialogError("")
    const productTeams = getProductTeams(activeProduct!)

    const upserts: { product_id: string; team_id: string; date: string; quantity: number }[] = []
    for (const team of productTeams) {
      const val = dialogQuantities[team.id]
      if (val === undefined || val.trim() === "") continue
      const qty = parseInt(val, 10)
      if (isNaN(qty) || qty < 0) {
        setDialogError(`Invalid quantity for ${team.name}.`)
        return
      }
      upserts.push({ product_id: activeProduct!, team_id: team.id, date: dialogDate, quantity: qty })
    }

    if (upserts.length === 0) {
      setDialogError("Enter at least one quantity.")
      return
    }

    setDialogLoading(true)

    const { error } = await supabase
      .from("production_entries")
      .upsert(upserts, { onConflict: "product_id,team_id,date" })

    setDialogLoading(false)

    if (error) {
      setDialogError(error.message)
      return
    }

    setDialogOpen(false)
    await loadEntries(
      products.map((p) => p.id),
      currentMonth
    )
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

  function formatMonthLabel(month: string) {
    const [y, m] = month.split("-").map(Number)
    return new Date(y, m - 1).toLocaleDateString(undefined, { year: "numeric", month: "long" })
  }

  const isWorkday = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00")
    const dow = d.getDay()
    return dow !== 0 && dow !== 6
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-80" />
        <div className="flex flex-col gap-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
        <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight">Production</h1>
        <p className="text-muted-foreground">No products configured yet.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight">Production</h1>
          <p className="text-muted-foreground mt-1">
            Track daily production by team for each product.
          </p>
        </div>
        <Button onClick={openEntryDialog} className="gap-1.5">
          <Factory className="size-4" />
          Enter Production
        </Button>
      </div>

      <Tabs value={activeProduct ?? undefined} onValueChange={setActiveProduct}>
        <TabsList>
          {products.map((p) => (
            <TabsTrigger key={p.id} value={p.id}>
              {p.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {products.map((product) => {
          const { days, rows, dailyTotals, grandTotal } = buildMonthGrid(product.id)
          return (
            <TabsContent key={product.id} value={product.id} className="mt-4">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={prevMonth}>
                    &larr;
                  </Button>
                  <span className="text-sm font-medium min-w-[160px] text-center">
                    {formatMonthLabel(currentMonth)}
                  </span>
                  <Button variant="outline" size="sm" onClick={nextMonth}>
                    &rarr;
                  </Button>
                </div>
                <span className="text-sm text-muted-foreground">
                  Line: {product.production_lines.name}
                </span>
              </div>

              <div className="rounded-xl border bg-card overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10 min-w-[80px]">Team</TableHead>
                      {days.map((day) => {
                        const d = new Date(day + "T12:00:00")
                        const wd = isWorkday(day)
                        return (
                          <TableHead
                            key={day}
                            className={`text-center min-w-[40px] px-1.5 text-xs ${
                              !wd ? "text-muted-foreground/50" : ""
                            }`}
                          >
                            <div>{d.getDate()}</div>
                          </TableHead>
                        )
                      })}
                      <TableHead className="text-right font-semibold bg-muted/50">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.team_id}>
                        <TableCell className="sticky left-0 bg-card z-10 font-medium text-sm">
                          {row.team_name}
                        </TableCell>
                        {days.map((day) => {
                          const val = row.entries.get(day)
                          const wd = isWorkday(day)
                          return (
                            <TableCell
                              key={day}
                              className={`text-center text-xs px-1.5 tabular-nums ${
                                !wd ? "text-muted-foreground/40" : ""
                              } ${val ? "font-medium" : ""}`}
                            >
                              {val ?? (wd ? "-" : "")}
                            </TableCell>
                          )
                        })}
                        <TableCell className="text-right font-semibold tabular-nums bg-muted/50">
                          {row.total || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Daily totals row */}
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell className="sticky left-0 bg-muted/30 z-10 text-sm">
                        Daily Total
                      </TableCell>
                      {days.map((day, i) => (
                        <TableCell
                          key={day}
                          className={`text-center text-xs px-1.5 tabular-nums ${
                            !isWorkday(day) ? "text-muted-foreground/40" : ""
                          }`}
                        >
                          {dailyTotals[i] || "-"}
                        </TableCell>
                      ))}
                      <TableCell className="text-right tabular-nums bg-muted/50">
                        {grandTotal || "-"}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Monthly summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                {rows.map((row) => (
                  <div
                    key={row.team_id}
                    className="rounded-lg border bg-card p-3 flex flex-col gap-1"
                  >
                    <span className="text-xs text-muted-foreground">{row.team_name}</span>
                    <span className="text-lg font-semibold tabular-nums">
                      {row.total.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">bottles</span>
                    </span>
                  </div>
                ))}
                <div className="rounded-lg border bg-primary/5 p-3 flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Grand Total</span>
                  <span className="text-lg font-semibold tabular-nums">
                    {grandTotal.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">bottles</span>
                  </span>
                </div>
              </div>
            </TabsContent>
          )
        })}
      </Tabs>

      {/* Entry dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Factory className="size-5 text-primary" />
              Enter Production
            </DialogTitle>
            <DialogDescription>
              Record daily production for{" "}
              <span className="font-medium text-foreground">
                {products.find((p) => p.id === activeProduct)?.name}
              </span>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEntrySubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="entry-date">Date</Label>
              <Input
                id="entry-date"
                type="date"
                value={dialogDate}
                onChange={(e) => setDialogDate(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-3">
              {getProductTeams(activeProduct!).map((team) => (
                <div key={team.id} className="flex items-center gap-3">
                  <Label className="text-sm min-w-[70px]">{team.name}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={dialogQuantities[team.id] ?? ""}
                    onChange={(e) =>
                      setDialogQuantities((prev) => ({ ...prev, [team.id]: e.target.value }))
                    }
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">bottles</span>
                </div>
              ))}
            </div>

            {dialogError && <p className="text-sm text-destructive">{dialogError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={dialogLoading}>
                {dialogLoading ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
