import * as React from "react"
import { Package, TrendingDown, TrendingUp, Layers } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { supabase } from "@/lib/supabase"
import { UNITS, type RawMaterial } from "@/lib/types"

export function Dashboard() {
  const [materials, setMaterials] = React.useState<RawMaterial[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("raw_materials")
        .select("*")
        .order("name")
      setMaterials((data as RawMaterial[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const totalMaterials = materials.length
  const zeroStock = materials.filter((m) => m.current_quantity === 0).length
  const inStock = materials.filter((m) => m.current_quantity > 0).length

  return (
    <div className="flex flex-col gap-8 p-6 max-w-5xl mx-auto w-full">
      <div>
        <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your raw material inventory.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
      </div>

      {/* Stock summary */}
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

      {/* Future widgets placeholder */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-dashed opacity-50">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Alerts</CardTitle>
            <CardDescription className="text-xs">Coming soon — configure reorder thresholds.</CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-dashed opacity-50">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Consumption Trends</CardTitle>
            <CardDescription className="text-xs">Coming soon — charts based on movement history.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
