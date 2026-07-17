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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { type StockMovement } from "@/lib/types"

interface Props {
  movement: (StockMovement & { materialUnit: string }) | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function EditStockMovementDialog({ movement, open, onClose, onSaved }: Props) {
  const [movementType, setMovementType] = React.useState<"IN" | "OUT">("IN")
  const [quantity, setQuantity] = React.useState("")
  const [date, setDate] = React.useState("")
  const [supplierName, setSupplierName] = React.useState("")
  const [invoiceNumber, setInvoiceNumber] = React.useState("")
  const [note, setNote] = React.useState("")
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (movement && open) {
      setMovementType(movement.movement_type)
      setQuantity(movement.quantity.toString())
      setDate(movement.date.slice(0, 10))
      setSupplierName(movement.supplier_name ?? "")
      setInvoiceNumber(movement.invoice_number ?? "")
      setNote(movement.note ?? "")
      setError("")
    }
  }, [movement, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) { setError("Quantity must be a positive number."); return }
    if (!date) { setError("Date is required."); return }

    setLoading(true)


    // Update the stock movement
    const { error: movErr } = await supabase
      .from("stock_movements")
      .update({
        movement_type: movementType,
        quantity: qty,
        date: new Date(date).toISOString(),
        supplier_name: supplierName.trim() || null,
        invoice_number: invoiceNumber.trim() || null,
        note: note.trim() || null,
      })
      .eq("id", movement!.id)

    if (movErr) { setError(movErr.message); setLoading(false); return }

    setLoading(false)
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Stock Movement</DialogTitle>
          <DialogDescription>
            Update the details of this stock movement.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Type</Label>
            <Select value={movementType} onValueChange={(v) => setMovementType(v as "IN" | "OUT")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IN">Received (IN)</SelectItem>
                <SelectItem value="OUT">Consumed (OUT)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="esmov-qty">
                Quantity{movement && ` (${movement.materialUnit})`}
              </Label>
              <Input
                id="esmov-qty"
                type="number"
                min="0.001"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="esmov-date">Date</Label>
              <Input
                id="esmov-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="esmov-supplier">Supplier (optional)</Label>
              <Input
                id="esmov-supplier"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="esmov-invoice">Invoice (optional)</Label>
              <Input
                id="esmov-invoice"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="esmov-note">Note (optional)</Label>
            <Textarea
              id="esmov-note"
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
