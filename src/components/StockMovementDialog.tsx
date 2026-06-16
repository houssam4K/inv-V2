import * as React from "react"
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { supabase } from "@/lib/supabase"
import { UNITS, type RawMaterial } from "@/lib/types"

interface Props {
  material: RawMaterial | null
  type: "IN" | "OUT"
  onClose: () => void
  onDone: () => void
}

export function StockMovementDialog({ material, type, onClose, onDone }: Props) {
  const [quantity, setQuantity] = React.useState("")
  const [note, setNote] = React.useState("")
  const [supplierName, setSupplierName] = React.useState("")
  const [invoiceNumber, setInvoiceNumber] = React.useState("")
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!material) {
      setQuantity("")
      setNote("")
      setSupplierName("")
      setInvoiceNumber("")
      setError("")
    }
  }, [material])

  if (!material) return null

  const unitLabel = UNITS.find((u) => u.value === material.unit_of_measure)?.label ?? material.unit_of_measure
  const isIn = type === "IN"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) {
      setError("Quantity must be a positive number.")
      return
    }

    if (type === "OUT" && qty > material!.current_quantity) {
      setError(
        `Cannot subtract ${qty} ${material!.unit_of_measure} — only ${material!.current_quantity} ${material!.unit_of_measure} in stock.`
      )
      return
    }

    setLoading(true)

    const newQuantity = isIn
      ? material!.current_quantity + qty
      : material!.current_quantity - qty

    const [movRes, matRes] = await Promise.all([
      supabase.from("stock_movements").insert({
        raw_material_id: material!.id,
        movement_type: type,
        quantity: qty,
        note: note.trim() || null,
        supplier_name: isIn && supplierName.trim() ? supplierName.trim() : null,
        invoice_number: isIn && invoiceNumber.trim() ? invoiceNumber.trim() : null,
      }),
      supabase
        .from("raw_materials")
        .update({ current_quantity: newQuantity })
        .eq("id", material!.id),
    ])

    setLoading(false)

    if (movRes.error || matRes.error) {
      setError(movRes.error?.message ?? matRes.error?.message ?? "An error occurred.")
      return
    }

    onDone()
  }

  return (
    <Dialog open={!!material} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isIn ? (
              <ArrowUpCircle className="size-5 text-emerald-500" />
            ) : (
              <ArrowDownCircle className="size-5 text-amber-500" />
            )}
            {isIn ? "Add Stock" : "Use Stock"}
          </DialogTitle>
          <DialogDescription>
            {isIn ? "Record incoming stock for" : "Record stock consumption for"}{" "}
            <span className="font-medium text-foreground">{material.name}</span>.{" "}
            Current stock:{" "}
            <span className="font-medium text-foreground">
              {material.current_quantity} {material.unit_of_measure}
            </span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="mov-qty">Quantity ({unitLabel})</Label>
            <Input
              id="mov-qty"
              type="number"
              min="0.001"
              step="any"
              placeholder="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-invalid={!!error}
              autoFocus
            />
          </div>

          {isIn && (
            <>
              <Separator />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Supplier Info (optional)
              </p>
              <div className="flex flex-col gap-2">
                <Label htmlFor="mov-supplier">Supplier Name</Label>
                <Input
                  id="mov-supplier"
                  placeholder="e.g. SPA PTD"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="mov-invoice">Invoice Number</Label>
                <Input
                  id="mov-invoice"
                  placeholder="e.g. 77S8FP"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="mov-note">Note (optional)</Label>
            <Textarea
              id="mov-note"
              placeholder={
                isIn
                  ? "e.g. Opening stock, batch A"
                  : "e.g. Production run line 2"
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[70px]"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              variant={isIn ? "default" : "secondary"}
            >
              {loading ? "Saving..." : isIn ? "Add Stock" : "Use Stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
