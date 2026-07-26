import * as React from "react"
import { ArrowDownCircle, ArrowUpCircle, MoreHorizontal, Package2, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AddMaterialDialog } from "@/components/AddMaterialDialog"
import { EditMaterialDialog } from "@/components/EditMaterialDialog"
import { StockMovementDialog } from "@/components/StockMovementDialog"
import { MaterialHistorySheet } from "@/components/MaterialHistorySheet"
import { MaterialDetail } from "@/pages/MaterialDetail"
import { supabase } from "@/lib/supabase"
import { UNITS, type RawMaterial } from "@/lib/types"

export function StockStatus() {
  const [materials, setMaterials] = React.useState<RawMaterial[]>([])
  const [loading, setLoading] = React.useState(true)
  const [movement, setMovement] = React.useState<{ material: RawMaterial; type: "IN" | "OUT" } | null>(null)
  const [historyMaterial, setHistoryMaterial] = React.useState<RawMaterial | null>(null)
  const [detailMaterial, setDetailMaterial] = React.useState<RawMaterial | null>(null)
  const [editMaterial, setEditMaterial] = React.useState<RawMaterial | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<RawMaterial | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [loggedTodayIds, setLoggedTodayIds] = React.useState<Set<string>>(new Set())
  const [showUnloggedOnly, setShowUnloggedOnly] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<"all" | "out" | "critical" | "low">("all")
  const [loadError, setLoadError] = React.useState<string | null>(null)

  async function load() {
    setLoadError(null)
    const { data, error } = await supabase
      .from("raw_materials")
      .select("*")
      .order("name")
    if (error) {
      setLoadError(error.message)
      setLoading(false)
      return
    }
    setMaterials((data as RawMaterial[]) ?? [])

    // Figure out which materials already have a consumption ("OUT") movement today,
    // so we can flag the ones you haven't logged yet.
    // NOTE: assumes a `stock_movements` table with columns `material_id`, `type` ('IN'/'OUT'),
    // and `created_at`. Adjust the column/table names below if yours differ.
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const { data: movements, error: movementsError } = await supabase
      .from("stock_movements")
      .select("material_id")
      .eq("type", "OUT")
      .gte("created_at", startOfToday.toISOString())
    if (!movementsError) {
      setLoggedTodayIds(new Set((movements ?? []).map((mv: any) => mv.material_id)))
    }

    setLoading(false)
  }

  React.useEffect(() => { load() }, [])

  function openMovement(material: RawMaterial, type: "IN" | "OUT") {
    setMovement({ material, type })
  }

  async function handleMovementDone() {
    const done = movement
    setMovement(null)
    if (done?.type === "OUT") {
      setLoggedTodayIds((prev) => new Set(prev).add(done.material.id))
    }
    await load()
  }

  function handleMaterialUpdated(updated: RawMaterial) {
    setMaterials((prev) => prev.map((m) => m.id === updated.id ? updated : m))
    setDetailMaterial(updated)
  }

  function handleEditSaved(updated: RawMaterial) {
    setMaterials((prev) => prev.map((m) => m.id === updated.id ? updated : m))
    if (detailMaterial?.id === updated.id) setDetailMaterial(updated)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    // stock_movements, shipments, inventory_entries all cascade-delete automatically
    const { error } = await supabase.from("raw_materials").delete().eq("id", deleteTarget.id)
    setDeleting(false)
    if (error) {
      setDeleteError(error.message)
      return
    }
    setDeleteTarget(null)
    if (detailMaterial?.id === deleteTarget.id) setDetailMaterial(null)
    await load()
  }

  function daysLeftFor(m: RawMaterial) {
    return m.daily_consumption && m.daily_consumption > 0
      ? Math.floor(m.current_quantity / m.daily_consumption)
      : null
  }

  const summary = React.useMemo(() => {
    let out = 0, critical = 0, low = 0
    for (const m of materials) {
      if (m.current_quantity === 0) { out++; continue }
      const d = daysLeftFor(m)
      if (d !== null && d <= 3) critical++
      else if (d !== null && d <= 7) low++
    }
    return { total: materials.length, out, critical, low }
  }, [materials])

  const visibleMaterials = materials
    .filter((m) => !showUnloggedOnly || !loggedTodayIds.has(m.id))
    .filter((m) => m.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    .filter((m) => {
      if (statusFilter === "all") return true
      if (statusFilter === "out") return m.current_quantity === 0
      const d = daysLeftFor(m)
      if (statusFilter === "critical") return m.current_quantity !== 0 && d !== null && d <= 3
      if (statusFilter === "low") return m.current_quantity !== 0 && d !== null && d > 3 && d <= 7
      return true
    })

  if (detailMaterial) {
    return (
      <MaterialDetail
        key={detailMaterial.id}
        material={detailMaterial}
        onBack={() => setDetailMaterial(null)}
        onUpdated={handleMaterialUpdated}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight">Stock Status</h1>
          <p className="text-muted-foreground mt-1">
            Manage raw materials and record stock movements.{" "}
            <span className="text-xs">Click a material name for detailed history and forecasting.</span>
          </p>
          {!loading && materials.length > 0 && (
            <p className="text-sm mt-2">
              <span className="font-medium">{loggedTodayIds.size}</span>
              <span className="text-muted-foreground"> of {materials.length} logged today</span>
              {loggedTodayIds.size < materials.length && (
                <Button
                  size="sm"
                  variant={showUnloggedOnly ? "default" : "outline"}
                  className="ml-3 h-7 text-xs"
                  onClick={() => setShowUnloggedOnly((v) => !v)}
                >
                  {showUnloggedOnly ? "Show all" : `Show ${materials.length - loggedTodayIds.size} not logged yet`}
                </Button>
              )}
            </p>
          )}
        </div>
        <AddMaterialDialog onCreated={load} />
      </div>

      {loadError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Couldn't load materials: {loadError}
        </div>
      )}

      {!loading && !loadError && materials.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: "all" as const, label: "Total", value: summary.total },
              { key: "out" as const, label: "Out of stock", value: summary.out, tone: "text-destructive" },
              { key: "critical" as const, label: "Critical (≤3 days)", value: summary.critical, tone: "text-destructive" },
              { key: "low" as const, label: "Low (≤7 days)", value: summary.low, tone: "text-amber-600 dark:text-amber-400" },
            ].map((card) => (
              <button
                key={card.key}
                onClick={() => setStatusFilter(statusFilter === card.key ? "all" : card.key)}
                className={`text-left rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50 ${
                  statusFilter === card.key ? "ring-2 ring-primary" : ""
                }`}
              >
                <div className={`text-2xl font-semibold tabular-nums ${card.tone ?? ""}`}>{card.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{card.label}</div>
              </button>
            ))}
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search materials..."
            aria-label="Search materials"
            className="w-full max-w-xs rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </>
      )}

      {loading ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : materials.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Package2 />
              </EmptyMedia>
              <EmptyTitle>No materials yet</EmptyTitle>
              <EmptyDescription>
                Add your first raw material to start tracking inventory.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : visibleMaterials.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Package2 />
              </EmptyMedia>
              <EmptyTitle>No matches</EmptyTitle>
              <EmptyDescription>
                Nothing matches your current search/filter. Try clearing them.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Current Stock</TableHead>
                <TableHead className="text-right">Days Left</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleMaterials.map((m) => {
                const unitLabel = UNITS.find((u) => u.value === m.unit_of_measure)?.label ?? m.unit_of_measure
                const loggedToday = loggedTodayIds.has(m.id)
                const isEmpty = m.current_quantity === 0
                const daysLeft = daysLeftFor(m)
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-2 rounded-full shrink-0 ${
                            loggedToday ? "bg-emerald-500" : "bg-muted-foreground/30"
                          }`}
                          title={loggedToday ? "Consumption logged today" : "Not logged today yet"}
                        />
                        <button
                          onClick={() => setDetailMaterial(m)}
                          className="font-medium text-left underline-offset-4 hover:underline hover:text-primary transition-colors cursor-pointer"
                        >
                          {m.name}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">
                        {unitLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={isEmpty ? "text-destructive font-medium" : "font-medium"}>
                        {m.current_quantity}
                        <span className="text-muted-foreground font-normal ml-1 text-xs">
                          {m.unit_of_measure}
                        </span>
                      </span>
                      {isEmpty && (
                        <Badge
                          variant="outline"
                          className="ml-2 text-destructive border-destructive/30 text-xs"
                        >
                          Out of stock
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {daysLeft !== null ? (
                        <span className={`font-medium tabular-nums ${
                          daysLeft <= 3
                            ? "text-destructive"
                            : daysLeft <= 7
                            ? "text-amber-600 dark:text-amber-400"
                            : ""
                        }`}>
                          {daysLeft}
                          <span className="text-muted-foreground font-normal ml-1 text-xs">days</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-900 dark:hover:bg-emerald-950 dark:text-emerald-400"
                          onClick={() => openMovement(m, "IN")}
                          aria-label={`Add stock for ${m.name}`}
                        >
                          <ArrowUpCircle className="size-3.5" />
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-900 dark:hover:bg-amber-950 dark:text-amber-400"
                          disabled={isEmpty}
                          onClick={() => openMovement(m, "OUT")}
                          aria-label={`Log consumption for ${m.name}`}
                        >
                          <ArrowDownCircle className="size-3.5" />
                          Use
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="size-8 p-0" aria-label={`More actions for ${m.name}`}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditMaterial(m)}>
                              <Pencil className="size-3.5 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteTarget(m)}
                            >
                              <Trash2 className="size-3.5 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <StockMovementDialog
        material={movement?.material ?? null}
        type={movement?.type ?? "IN"}
        onClose={() => setMovement(null)}
        onDone={handleMovementDone}
      />

      <MaterialHistorySheet
        material={historyMaterial}
        onClose={() => setHistoryMaterial(null)}
      />

      <EditMaterialDialog
        material={editMaterial}
        open={!!editMaterial}
        onClose={() => setEditMaterial(null)}
        onSaved={handleEditSaved}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) { setDeleteTarget(null); setDeleteError(null) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the material and all its stock movement history.
              The current stock of <strong>{deleteTarget?.current_quantity} {deleteTarget?.unit_of_measure}</strong> will be removed.
              This action cannot be undone.
            </AlertDialogDescription>
            {deleteError && (
              <p className="text-sm text-destructive mt-2 font-medium">{deleteError}</p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Material"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
