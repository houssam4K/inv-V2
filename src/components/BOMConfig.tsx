import * as React from "react"
import { Plus, Pencil, Trash2, Save, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { supabase } from "@/lib/supabase"
import type { BOMItem } from "@/lib/types"

// ── PRODUCT_SPECS mirror (for 5.5L fardeau check) ───────────────────────────
// We only need the key and fardeauxPerPallet here.
const FARDEAU_DISABLED_KEYS = ["5.5"] // products whose name includes these have no fardeaux

type UnitType = BOMItem["unit_type"]

const UNIT_LABELS: Record<UnitType, string> = {
  per_bottle: "Per bottle",
  per_fardeau: "Per fardeau",
  per_pallet: "Per pallet",
  unknown: "Unknown",
}

interface Product {
  id: string
  name: string
}

interface RawMaterial {
  id: string
  name: string
  unit_of_measure: string
}

export function BOMConfig() {
  const [products, setProducts] = React.useState<Product[]>([])
  const [rawMaterials, setRawMaterials] = React.useState<RawMaterial[]>([])
  const [bomItems, setBomItems] = React.useState<BOMItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // ── Add dialog state ────────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = React.useState(false)
  const [addProductId, setAddProductId] = React.useState("")
  const [addRawMaterialId, setAddRawMaterialId] = React.useState("")
  const [addUnitType, setAddUnitType] = React.useState<UnitType>("per_bottle")
  const [addQty, setAddQty] = React.useState("")
  const [addLoading, setAddLoading] = React.useState(false)
  const [addError, setAddError] = React.useState("")

  // ── Inline edit state ───────────────────────────────────────────────────────
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editUnitType, setEditUnitType] = React.useState<UnitType>("per_bottle")
  const [editQty, setEditQty] = React.useState("")
  const [editLoading, setEditLoading] = React.useState(false)
  const [editError, setEditError] = React.useState("")

  // ── Load ────────────────────────────────────────────────────────────────────
  async function loadAll() {
    setLoading(true)
    const [prodsRes, matsRes, bomRes] = await Promise.all([
      supabase.from("products").select("id, name").order("name"),
      supabase.from("raw_materials").select("id, name, unit_of_measure").order("name"),
      supabase
        .from("bom_items")
        .select("*, raw_materials(name,unit_of_measure), products(name)")
        .order("created_at"),
    ])
    setProducts((prodsRes.data as Product[]) ?? [])
    setRawMaterials((matsRes.data as RawMaterial[]) ?? [])
    setBomItems((bomRes.data as BOMItem[]) ?? [])
    setLoading(false)
  }

  async function reloadBOM() {
    const { data } = await supabase
      .from("bom_items")
      .select("*, raw_materials(name,unit_of_measure), products(name)")
      .order("created_at")
    setBomItems((data as BOMItem[]) ?? [])
  }

  React.useEffect(() => {
    loadAll()
  }, [])

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function isFardeauDisabled(productId: string): boolean {
    const p = products.find((x) => x.id === productId)
    if (!p) return false
    return FARDEAU_DISABLED_KEYS.some((k) => p.name.includes(k))
  }

  /** Raw materials NOT yet configured for a given product */
  function availableMaterials(productId: string): RawMaterial[] {
    const used = new Set(
      bomItems
        .filter((b) => b.product_id === productId)
        .map((b) => b.raw_material_id)
    )
    return rawMaterials.filter((m) => !used.has(m.id))
  }

  // ── Open add dialog ─────────────────────────────────────────────────────────
  function openAdd() {
    setAddProductId(products[0]?.id ?? "")
    setAddRawMaterialId("")
    setAddUnitType("per_bottle")
    setAddQty("")
    setAddError("")
    setAddOpen(true)
  }

  // ── Save add ────────────────────────────────────────────────────────────────
  async function handleAdd() {
    if (!addProductId || !addRawMaterialId) {
      setAddError("Please select a product and a raw material.")
      return
    }
    const qtyVal =
      addUnitType === "unknown" ? null : addQty.trim() === "" ? null : Number(addQty)
    if (addUnitType !== "unknown" && (qtyVal === null || isNaN(qtyVal) || qtyVal < 0)) {
      setAddError("Enter a valid quantity.")
      return
    }
    setAddLoading(true)
    setAddError("")
    const { error: err } = await supabase.from("bom_items").insert({
      product_id: addProductId,
      raw_material_id: addRawMaterialId,
      unit_type: addUnitType,
      quantity_per_unit: qtyVal,
    })
    setAddLoading(false)
    if (err) { setAddError(err.message); return }
    setAddOpen(false)
    await reloadBOM()
  }

  // ── Start edit ──────────────────────────────────────────────────────────────
  function startEdit(item: BOMItem) {
    setEditingId(item.id)
    setEditUnitType(item.unit_type)
    setEditQty(item.quantity_per_unit != null ? String(item.quantity_per_unit) : "")
    setEditError("")
  }

  // ── Save edit ───────────────────────────────────────────────────────────────
  async function handleEdit(id: string) {
    const qtyVal =
      editUnitType === "unknown" ? null : editQty.trim() === "" ? null : Number(editQty)
    if (editUnitType !== "unknown" && (qtyVal === null || isNaN(qtyVal) || qtyVal < 0)) {
      setEditError("Enter a valid quantity.")
      return
    }
    setEditLoading(true)
    setEditError("")
    const { error: err } = await supabase
      .from("bom_items")
      .update({ unit_type: editUnitType, quantity_per_unit: qtyVal })
      .eq("id", id)
    setEditLoading(false)
    if (err) { setEditError(err.message); return }
    setEditingId(null)
    await reloadBOM()
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!window.confirm("Delete this BOM entry?")) return
    await supabase.from("bom_items").delete().eq("id", id)
    await reloadBOM()
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col gap-4 py-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive py-4">{error}</p>
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Configure the theoretical consumption formula for each raw material per product.
          </p>
        </div>
        <Button onClick={openAdd} size="sm" className="gap-1.5">
          <Plus className="size-4" />
          Add BOM entry
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Raw Material</TableHead>
              <TableHead>Consumption unit</TableHead>
              <TableHead>Qty / unit</TableHead>
              <TableHead className="w-[120px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bomItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  No BOM entries yet. Click "+ Add BOM entry" to start.
                </TableCell>
              </TableRow>
            )}
            {bomItems.map((item) => {
              const isEditing = editingId === item.id
              return (
                <TableRow
                  key={item.id}
                  className={isEditing ? "bg-muted/30" : undefined}
                >
                  {/* Product */}
                  <TableCell className="font-medium text-sm">
                    {item.products?.name ?? "—"}
                  </TableCell>

                  {/* Raw Material */}
                  <TableCell className="text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span>{item.raw_materials?.name ?? "—"}</span>
                      {item.raw_materials?.unit_of_measure && (
                        <span className="text-xs text-muted-foreground">
                          {item.raw_materials.unit_of_measure}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Consumption unit — editable inline */}
                  <TableCell>
                    {isEditing ? (
                      <select
                        value={editUnitType}
                        onChange={(e) => setEditUnitType(e.target.value as UnitType)}
                        className="text-sm border rounded-md px-2 py-1 bg-background w-full"
                      >
                        {(Object.keys(UNIT_LABELS) as UnitType[]).map((u) => (
                          <option key={u} value={u}>
                            {UNIT_LABELS[u]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge variant="outline" className="font-normal text-xs">
                        {UNIT_LABELS[item.unit_type]}
                      </Badge>
                    )}
                  </TableCell>

                  {/* Qty per unit — editable inline */}
                  <TableCell className="tabular-nums">
                    {isEditing ? (
                      editUnitType === "unknown" ? (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      ) : (
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          className="text-sm border rounded-md px-2 py-1 bg-background w-24"
                        />
                      )
                    ) : (
                      item.unit_type === "unknown"
                        ? <span className="text-muted-foreground text-xs">N/A</span>
                        : item.quantity_per_unit != null
                          ? item.quantity_per_unit.toLocaleString()
                          : <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 flex-col">
                        {editError && (
                          <p className="text-xs text-destructive">{editError}</p>
                        )}
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 px-2 gap-1 text-xs"
                            onClick={() => handleEdit(item.id)}
                            disabled={editLoading}
                          >
                            <Save className="size-3" />
                            {editLoading ? "Saving…" : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onClick={() => startEdit(item)}
                          title="Edit"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(item.id)}
                          title="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Add BOM Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-primary" />
              Add BOM Entry
            </DialogTitle>
            <DialogDescription>
              Define the theoretical consumption of a raw material for a product.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Product selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Product</label>
              <select
                value={addProductId}
                onChange={(e) => {
                  setAddProductId(e.target.value)
                  setAddRawMaterialId("")
                  // Reset fardeau if disabled
                  if (
                    isFardeauDisabled(e.target.value) &&
                    addUnitType === "per_fardeau"
                  ) {
                    setAddUnitType("per_bottle")
                  }
                }}
                className="text-sm border rounded-md px-3 py-2 bg-background"
              >
                <option value="">— Select product —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Raw material selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Raw Material</label>
              <select
                value={addRawMaterialId}
                onChange={(e) => setAddRawMaterialId(e.target.value)}
                className="text-sm border rounded-md px-3 py-2 bg-background"
                disabled={!addProductId}
              >
                <option value="">— Select material —</option>
                {availableMaterials(addProductId).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit_of_measure})
                  </option>
                ))}
              </select>
              {addProductId && availableMaterials(addProductId).length === 0 && (
                <p className="text-xs text-muted-foreground">
                  All materials are already configured for this product.
                </p>
              )}
            </div>

            {/* Unit type selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Consumption unit</label>
              <select
                value={addUnitType}
                onChange={(e) => setAddUnitType(e.target.value as UnitType)}
                className="text-sm border rounded-md px-3 py-2 bg-background"
              >
                {(Object.keys(UNIT_LABELS) as UnitType[]).map((u) => (
                  <option
                    key={u}
                    value={u}
                    disabled={u === "per_fardeau" && isFardeauDisabled(addProductId)}
                  >
                    {UNIT_LABELS[u]}
                    {u === "per_fardeau" && isFardeauDisabled(addProductId)
                      ? " (not available for this product)"
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Qty per unit */}
            {addUnitType !== "unknown" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Qty per unit</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 1.05"
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  className="text-sm border rounded-md px-3 py-2 bg-background"
                />
              </div>
            )}

            {addError && (
              <p className="text-sm text-destructive">{addError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={addLoading}>
              {addLoading ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
