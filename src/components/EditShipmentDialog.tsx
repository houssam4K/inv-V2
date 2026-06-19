import * as React from "react"
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
import { supabase } from "@/lib/supabase"

export interface ShipmentEditRow {
  id: string
  date: string
  raw_material_id: string
  quantity: number
  unit_price: number
  invoice_number: string | null
  note: string | null
  raw_materials: { name: string; unit_of_measure: string }
}

interface Props {
  shipment: ShipmentEditRow | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function EditShipmentDialog({ shipment, open, onClose, onSaved }: Props) {
  const [date, setDate] = React.useState("")
  const [quantity, setQuantity] = React.useState("")
  const [unitPrice, setUnitPrice] = React.useState("")
  const [invoiceNumber, setInvoiceNumber] = React.useState("")
  const [note, setNote] = React.useState("")
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (shipment && open) {
      setDate(shipment.date)
      setQuantity(shipment.quantity.toString())
      setUnitPrice(shipment.unit_price.toString())
      setInvoiceNumber(shipment.invoice_number ?? "")
      setNote(shipment.note ?? "")
      setError("")
    }
  }, [shipment, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) { setError("Quantity must be a positive number."); return }
    const price = parseFloat(unitPrice)
    if (isNaN(price) || price < 0) { setError("Unit price must be 0 or more."); return }
    if (!date) { setError("Date is required."); return }

    setLoading(true)

    const oldQty = shipment!.quantity
    const qtyDiff = qty - oldQty

    // 1. Update the shipment record
    const { error: shipErr } = await supabase
      .from("shipments")
      .update({
        date,
        quantity: qty,
        unit_price: price,
        invoice_number: invoiceNumber.trim() || null,
        note: note.trim() || null,
      })
      .eq("id", shipment!.id)

    if (shipErr) { setError(shipErr.message); setLoading(false); return }

    // 2. Adjust raw material current_quantity if quantity changed
    if (qtyDiff !== 0) {
      const { data: mat } = await supabase
        .from("raw_materials")
        .select("current_quantity")
        .eq("id", shipment!.raw_material_id)
        .single()

      if (mat) {
        await supabase
          .from("raw_materials")
          .update({ current_quantity: mat.current_quantity + qtyDiff })
          .eq("id", shipment!.raw_material_id)
      }
    }

    // 3. Update the linked stock movement if it exists (by shipment_id)
    const { data: movRows } = await supabase
      .from("stock_movements")
      .select("id")
      .eq("shipment_id", shipment!.id)
      .limit(1)

    if (movRows && movRows.length > 0) {
      await supabase
        .from("stock_movements")
        .update({
          quantity: qty,
          date: new Date(date).toISOString(),
          invoice_number: invoiceNumber.trim() || null,
          note: note.trim() || null,
        })
        .eq("id", movRows[0].id)
    }

    setLoading(false)
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Shipment</DialogTitle>
          <DialogDescription>
            {shipment && (
              <>Editing delivery of <span className="font-medium text-foreground">{shipment.raw_materials.name}</span>.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="eship-qty">
                Quantity{shipment && ` (${shipment.raw_materials.unit_of_measure})`}
              </Label>
              <Input
                id="eship-qty"
                type="number"
                min="0.001"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="eship-price">Unit Price (DA)</Label>
              <Input
                id="eship-price"
                type="number"
                min="0"
                step="any"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="eship-invoice">Invoice Number (optional)</Label>
              <Input
                id="eship-invoice"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="eship-date">Date</Label>
              <Input
                id="eship-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="eship-note">Note (optional)</Label>
            <Textarea
              id="eship-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[60px]"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
