import * as React from "react"
import {
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  History,
  Package,
  Truck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { supabase } from "@/lib/supabase"
import { UNITS, type RawMaterial, type StockMovement } from "@/lib/types"

interface Props {
  material: RawMaterial | null
  onClose: () => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function MaterialHistorySheet({ material, onClose }: Props) {
  const [movements, setMovements] = React.useState<StockMovement[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!material) return
    setLoading(true)
    supabase
      .from("stock_movements")
      .select("*")
      .eq("raw_material_id", material.id)
      .order("date", { ascending: false })
      .then(({ data }) => {
        setMovements((data as StockMovement[]) ?? [])
        setLoading(false)
      })
  }, [material?.id])

  const unitLabel =
    UNITS.find((u) => u.value === material?.unit_of_measure)?.label ??
    material?.unit_of_measure

  // Group movements by date for visual separation
  const grouped = React.useMemo(() => {
    const map = new Map<string, StockMovement[]>()
    for (const m of movements) {
      const key = formatDate(m.date)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(m)
    }
    return Array.from(map.entries())
  }, [movements])

  return (
    <Sheet open={!!material} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="flex items-center gap-2">
            <Package className="size-4 text-muted-foreground" />
            {material?.name}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <History className="size-3.5" />
              Movement history
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span>
              Current stock:{" "}
              <span className="font-medium text-foreground">
                {material?.current_quantity} {material?.unit_of_measure}
              </span>{" "}
              <span className="text-muted-foreground">({unitLabel})</span>
            </span>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4">
            {loading ? (
              <div className="flex flex-col gap-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : movements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <History className="size-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  No movements yet
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Add or use stock to start tracking history.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {grouped.map(([date, items]) => (
                  <div key={date} className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 bg-background py-1">
                      {date}
                    </p>
                    <div className="flex flex-col gap-2">
                      {items.map((mov) => {
                        const isIn = mov.movement_type === "IN"
                        return (
                          <div
                            key={mov.id}
                            className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3"
                          >
                            {/* Icon */}
                            <div
                              className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
                                isIn
                                  ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                                  : "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
                              }`}
                            >
                              {isIn ? (
                                <ArrowUpCircle className="size-4" />
                              ) : (
                                <ArrowDownCircle className="size-4" />
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex flex-1 flex-col gap-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                {/* Quantity */}
                                <span
                                  className={`text-sm font-semibold tabular-nums ${
                                    isIn
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-amber-600 dark:text-amber-400"
                                  }`}
                                >
                                  {isIn ? "+" : "-"}
                                  {mov.quantity} {material?.unit_of_measure}
                                </span>
                                {/* Time */}
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {formatTime(mov.date)}
                                </span>
                              </div>

                              {/* Supplier / Invoice row */}
                              {(mov.supplier_name || mov.invoice_number) && (
                                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                  {mov.supplier_name && (
                                    <Badge
                                      variant="secondary"
                                      className="gap-1 text-xs font-normal"
                                    >
                                      <Truck className="size-3" />
                                      {mov.supplier_name}
                                    </Badge>
                                  )}
                                  {mov.invoice_number && (
                                    <Badge
                                      variant="outline"
                                      className="gap-1 text-xs font-normal font-mono"
                                    >
                                      <FileText className="size-3" />
                                      {mov.invoice_number}
                                    </Badge>
                                  )}
                                </div>
                              )}

                              {/* Note */}
                              {mov.note && (
                                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                                  {mov.note}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                <Separator />
                <p className="text-xs text-center text-muted-foreground pb-2">
                  {movements.length} movement{movements.length !== 1 ? "s" : ""} recorded
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
