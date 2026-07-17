import * as React from "react"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Plus,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { NewInventoryDialog } from "@/components/NewInventoryDialog"
import { supabase } from "@/lib/supabase"
import type { InventorySession } from "@/lib/types"

interface EntryRow {
  id: string
  theoretical_quantity: number
  real_quantity: number
  raw_materials: { name: string; unit_of_measure: string }
}

interface SessionWithStats extends InventorySession {
  entryCount: number
  totalEcart: number
  lossCount: number
  surplusCount: number
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

type Statut = "ok" | "perte" | "surplus"

function getStatut(ecart: number): Statut {
  if (ecart === 0) return "ok"
  if (ecart > 0) return "perte"
  return "surplus"
}

function StatutBadge({ ecart }: { ecart: number }) {
  const s = getStatut(ecart)
  if (s === "ok")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="size-3.5" />
        OK
      </span>
    )
  if (s === "perte")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
        <AlertTriangle className="size-3.5" />
        Perte
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400">
      <XCircle className="size-3.5" />
      Surplus
    </span>
  )
}

// ---------- Session Detail ----------

interface DetailProps {
  session: InventorySession
  onBack: () => void
}

function SessionDetail({ session, onBack }: DetailProps) {
  const [entries, setEntries] = React.useState<EntryRow[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    supabase
      .from("inventory_entries")
      .select("*, raw_materials(name, unit_of_measure)")
      .eq("session_id", session.id)
      .order("created_at")
      .then(({ data }) => {
        setEntries((data as EntryRow[]) ?? [])
        setLoading(false)
      })
  }, [session.id])

  const totalEcart = entries.reduce((acc, e) => acc + (e.theoretical_quantity - e.real_quantity), 0)
  const perteCount = entries.filter((e) => e.theoretical_quantity - e.real_quantity > 0).length
  const surplusCount = entries.filter((e) => e.theoretical_quantity - e.real_quantity < 0).length
  const okCount = entries.filter((e) => e.theoretical_quantity - e.real_quantity === 0).length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="-ml-1 mt-0.5 shrink-0">
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight">
            Inventory — {formatDate(session.date)}
          </h1>
          {session.note && (
            <p className="text-muted-foreground mt-1 text-sm">{session.note}</p>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground mb-1">Materials Checked</div>
          <div className="text-xl font-semibold">{entries.length}</div>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <CheckCircle2 className="size-3 text-emerald-600" />
            OK
          </div>
          <div className="text-xl font-semibold text-emerald-700 dark:text-emerald-400">{okCount}</div>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <AlertTriangle className="size-3 text-amber-600" />
            Pertes
          </div>
          <div className="text-xl font-semibold text-amber-700 dark:text-amber-400">{perteCount}</div>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <XCircle className="size-3 text-blue-600" />
            Surplus
          </div>
          <div className="text-xl font-semibold text-blue-700 dark:text-blue-400">{surplusCount}</div>
        </div>
      </div>

      <Separator />

      {/* Detail table */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ClipboardList className="size-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No entries in this session</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Théorique</TableHead>
                <TableHead className="text-right">Réel</TableHead>
                <TableHead className="text-right">Écart</TableHead>
                <TableHead className="text-center">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => {
                const ecart = e.theoretical_quantity - e.real_quantity
                const s = getStatut(ecart)
                return (
                  <TableRow
                    key={e.id}
                    className={
                      s === "perte"
                        ? "bg-amber-50/50 dark:bg-amber-950/20"
                        : s === "surplus"
                        ? "bg-blue-50/50 dark:bg-blue-950/20"
                        : ""
                    }
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{e.raw_materials.name}</span>
                        <span className="text-xs text-muted-foreground">{e.raw_materials.unit_of_measure}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                      {e.theoretical_quantity}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {e.real_quantity}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums font-semibold ${
                        ecart > 0
                          ? "text-amber-700 dark:text-amber-400"
                          : ecart < 0
                          ? "text-blue-700 dark:text-blue-400"
                          : "text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      {ecart > 0 ? `−${ecart}` : ecart < 0 ? `+${Math.abs(ecart)}` : "0"}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatutBadge ecart={ecart} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Total écart footer */}
      {entries.length > 0 && (
        <div className="rounded-xl border bg-muted/30 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total écart (pertes)</span>
          <span
            className={`font-semibold tabular-nums ${
              totalEcart > 0
                ? "text-amber-700 dark:text-amber-400"
                : totalEcart < 0
                ? "text-blue-700 dark:text-blue-400"
                : "text-emerald-700 dark:text-emerald-400"
            }`}
          >
            {totalEcart > 0 ? `−${totalEcart}` : totalEcart < 0 ? `+${Math.abs(totalEcart)}` : "0"}
          </span>
        </div>
      )}
    </div>
  )
}

// ---------- Session List ----------

interface ListProps {
  onSelect: (session: InventorySession) => void
  onRefreshKey: number
}

function SessionList({ onSelect, onRefreshKey }: ListProps) {
  const [sessions, setSessions] = React.useState<SessionWithStats[]>([])
  const [loading, setLoading] = React.useState(true)

  async function load() {
    setLoading(true)
    const [sessRes, entRes] = await Promise.all([
      supabase.from("inventory_sessions").select("*").order("date", { ascending: false }),
      supabase.from("inventory_entries").select("session_id, theoretical_quantity, real_quantity"),
    ])

    const sessList = (sessRes.data as InventorySession[]) ?? []
    const entList = (entRes.data as { session_id: string; theoretical_quantity: number; real_quantity: number }[]) ?? []

    const withStats: SessionWithStats[] = sessList.map((s) => {
      const ents = entList.filter((e) => e.session_id === s.id)
      const lossCount = ents.filter(e => e.theoretical_quantity - e.real_quantity > 0).length
      const surplusCount = ents.filter(e => e.theoretical_quantity - e.real_quantity < 0).length
      const totalEcart = ents.reduce((acc, e) => acc + (e.theoretical_quantity - e.real_quantity), 0)
      return { ...s, entryCount: ents.length, totalEcart, lossCount, surplusCount }
    })

    setSessions(withStats)
    setLoading(false)
  }

  React.useEffect(() => { load() }, [onRefreshKey])

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border bg-card">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList />
            </EmptyMedia>
            <EmptyTitle>No inventory sessions yet</EmptyTitle>
            <EmptyDescription>
              Click "+ New Inventory" to record your first physical count.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {sessions.map((s) => {
        const hasLoss = s.lossCount > 0
        const hasSurplus = s.surplusCount > 0
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s)}
            className="text-left rounded-xl border bg-card px-5 py-4 hover:bg-accent/50 transition-colors w-full group"
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <ClipboardList className="size-4 text-muted-foreground" />
                  <span className="font-semibold text-base group-hover:text-primary transition-colors">
                    {formatDate(s.date)}
                  </span>
                  {s.note && (
                    <span className="text-xs text-muted-foreground">— {s.note}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  {s.entryCount} material{s.entryCount !== 1 ? "s" : ""} checked
                </p>
              </div>
              <div className="flex items-center gap-3">
                {hasLoss && (
                  <Badge
                    variant="outline"
                    className="text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-800 text-xs gap-1"
                  >
                    <AlertTriangle className="size-3" />
                    {s.lossCount} Perte{s.lossCount !== 1 ? 's' : ''}
                  </Badge>
                )}
                {hasSurplus && (
                  <Badge
                    variant="outline"
                    className="text-blue-700 border-blue-300 dark:text-blue-400 dark:border-blue-800 text-xs gap-1"
                  >
                    <XCircle className="size-3" />
                    {s.surplusCount} Surplus
                  </Badge>
                )}
                {!hasLoss && !hasSurplus && s.entryCount > 0 && (
                  <Badge
                    variant="outline"
                    className="text-emerald-700 border-emerald-300 dark:text-emerald-400 dark:border-emerald-800 text-xs gap-1"
                  >
                    <CheckCircle2 className="size-3" />
                    All OK
                  </Badge>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ---------- Page Root ----------

export function PhysicalInventory() {
  const [selected, setSelected] = React.useState<InventorySession | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [refreshKey, setRefreshKey] = React.useState(0)

  function handleBack() {
    setSelected(null)
    setRefreshKey((k) => k + 1)
  }

  if (selected) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full">
        <SessionDetail session={selected} onBack={handleBack} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight">Physical Inventory</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Compare theoretical stock (system) vs real counted stock.{" "}
            <span className="text-xs">Click a session to see details.</span>
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus />
          New Inventory
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">Legend:</span>
        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-3.5" /> OK — Écart = 0
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="size-3.5" /> Perte — Théorique &gt; Réel (losses/déchets)
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400">
          <XCircle className="size-3.5" /> Surplus — Réel &gt; Théorique
        </span>
      </div>

      <SessionList onSelect={setSelected} onRefreshKey={refreshKey} />

      <NewInventoryDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onDone={() => {
          setDialogOpen(false)
          setRefreshKey((k) => k + 1)
        }}
      />
    </div>
  )
}
