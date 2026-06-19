import * as React from "react"
import { Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { PACKAGING_TYPES, type RawMaterial, type Supplier } from "@/lib/types"

interface Props {
  supplier: Supplier | null
  open: boolean
  onClose: () => void
  onDone: () => void
}

export function NewShipmentDialog({ supplier, open, onClose, onDone }: Props) {
  const [materials, setMaterials] = React.useState<RawMaterial[]>([])
  const [materialId, setMaterialId] = React.useState("")
  const [quantity, setQuantity] = React.useState("")
  const [unitPrice, setUnitPrice] = React.useState("")
  const [invoiceNumber, setInvoiceNumber] = React.useState("")
  const [date, setDate] = React.useState("")
  const [note, setNote] = React.useState("")
  const [showPackaging, setShowPackaging] = React.useState(false)
  const [packagingQtys, setPackagingQtys] = React.useState<Record<string, string>>({ box: "", pallet: "", mandrin: "" })
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    supabase.from("raw_materials").select("*").order("name").then(({ data }) => {
      setMaterials((data as RawMaterial[]) ?? [])
    })
  }, [])

  React.useEffect(() => {
    if (open) {
      const today = new Date().toISOString().slice(0, 10)
      setDate(today)
      setMaterialId("")
      setQuantity("")
      setUnitPrice("")
      setInvoiceNumber("")
      setNote("")
      setShowPackaging(false)
      setPackagingQtys({ box: "", pallet: "", mandrin: "" })
      setError("")
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!materialId) { setError("Select a raw material."); return }
    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) { setError("Quantity must be a positive number."); return }
    const price = parseFloat(unitPrice)
    if (isNaN(price) || price < 0) { setError("Unit price must be 0 or more."); return }
    if (!date) { setError("Date is required."); return }

    setLoading(true)

    const material = materials.find((m) => m.id === materialId)!

    // 1. Insert shipment
    const { data: shipmentData, error: shipErr } = await supabase
      .from("shipments")
      .insert({
        supplier_id: supplier!.id,
        raw_material_id: materialId,
        quantity: qty,
        unit_price: price,
        invoice_number: invoiceNumber.trim() || null,
        date,
        note: note.trim() || null,
      })
      .select("id")
      .single()

    if (shipErr) { setError(shipErr.message); setLoading(false); return }

    // 2. Insert stock movement + update material qty in parallel
    const newQty = material.current_quantity + qty
    const [movRes, matRes] = await Promise.all([
      supabase.from("stock_movements").insert({
        raw_material_id: materialId,
        movement_type: "IN",
        quantity: qty,
        date: new Date(date).toISOString(),
        supplier_name: supplier!.name,
        invoice_number: invoiceNumber.trim() || null,
        note: note.trim() || null,
        shipment_id: shipmentData.id,
      }),
      supabase
        .from("raw_materials")
        .update({ current_quantity: newQty })
        .eq("id", materialId),
    ])

    if (movRes.error || matRes.error) {
      setError(movRes.error?.message ?? matRes.error?.message ?? "Error updating stock.")
      setLoading(false)
      return
    }

    // 3. Insert packaging transactions (SENT) if any
    if (showPackaging) {
      const pkgInserts = PACKAGING_TYPES
        .filter((pt) => {
          const v = parseInt(packagingQtys[pt.value] ?? "", 10)
          return !isNaN(v) && v > 0
        })
        .map((pt) => ({
          supplier_id: supplier!.id,
          transaction_type: "SENT" as const,
          packaging_type: pt.value,
          quantity: parseInt(packagingQtys[pt.value], 10),
          date,
          shipment_id: shipmentData.id,
        }))

      if (pkgInserts.length > 0) {
        const { error: pkgErr } = await supabase.from("packaging_transactions").insert(pkgInserts)
        if (pkgErr) { setError(pkgErr.message); setLoading(false); return }
      }
    }

    setLoading(false)
    onDone()
  }

  if (!supplier) return null

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="size-5 text-primary" />
            New Shipment
          </DialogTitle>
          <DialogDescription>
            Record a delivery from{" "}
            <span className="font-medium text-foreground">{supplier.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Material */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="ship-material">Raw Material</Label>
            <Select value={materialId} onValueChange={setMaterialId}>
              <SelectTrigger id="ship-material" className="w-full">
                <SelectValue placeholder="Select material..." />
              </SelectTrigger>
              <SelectContent>
                {materials.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                    <span className="text-muted-foreground ml-1 text-xs">({m.unit_of_measure})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ship-qty">
                Quantity{materialId && ` (${materials.find((m) => m.id === materialId)?.unit_of_measure})`}
              </Label>
              <Input
                id="ship-qty"
                type="number"
                min="0.001"
                step="any"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ship-price">Unit Price (DA)</Label>
              <Input
                id="ship-price"
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ship-invoice">Invoice Number (optional)</Label>
              <Input
                id="ship-invoice"
                placeholder="e.g. INV-2026-001"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ship-date">Date</Label>
              <Input
                id="ship-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ship-note">Note (optional)</Label>
            <Textarea
              id="ship-note"
              placeholder="e.g. Batch A, good quality"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[60px]"
            />
          </div>

          <Separator />

          {/* Packaging section */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Packaging Received (optional)
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setShowPackaging((v) => !v)}
              >
                {showPackaging ? "Remove" : "+ Add Packaging"}
              </Button>
            </div>

            {showPackaging && (
              <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
                {PACKAGING_TYPES.map((pt) => (
                  <div key={pt.value} className="flex items-center gap-3">
                    <Label className="min-w-[70px] text-sm">{pt.label}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={packagingQtys[pt.value] ?? ""}
                      onChange={(e) =>
                        setPackagingQtys((prev) => ({ ...prev, [pt.value]: e.target.value }))
                      }
                      className="flex-1 h-8"
                    />
                    <span className="text-xs text-muted-foreground shrink-0 min-w-[30px]">
                      {pt.value === "box" ? "boxes" : pt.value === "pallet" ? "pallets" : "mandrins"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Total preview */}
          {quantity && unitPrice && !isNaN(parseFloat(quantity)) && !isNaN(parseFloat(unitPrice)) && (
            <div className="rounded-lg bg-muted/50 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-semibold tabular-nums">
                {(parseFloat(quantity) * parseFloat(unitPrice)).toLocaleString()} DA
              </span>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Record Shipment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
