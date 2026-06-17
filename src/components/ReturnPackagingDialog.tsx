import * as React from "react"
import { RotateCcw } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { PACKAGING_TYPES, type PackagingType, type Supplier } from "@/lib/types"

interface Props {
  supplier: Supplier | null
  open: boolean
  onClose: () => void
  onDone: () => void
}

export function ReturnPackagingDialog({ supplier, open, onClose, onDone }: Props) {
  const [packagingType, setPackagingType] = React.useState<PackagingType | "">("")
  const [quantity, setQuantity] = React.useState("")
  const [date, setDate] = React.useState("")
  const [note, setNote] = React.useState("")
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setPackagingType("")
      setQuantity("")
      setDate(new Date().toISOString().slice(0, 10))
      setNote("")
      setError("")
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!packagingType) { setError("Select a packaging type."); return }
    const qty = parseInt(quantity, 10)
    if (isNaN(qty) || qty <= 0) { setError("Quantity must be a positive whole number."); return }
    if (!date) { setError("Date is required."); return }

    setLoading(true)
    const { error: dbErr } = await supabase.from("packaging_transactions").insert({
      supplier_id: supplier!.id,
      transaction_type: "RETURNED",
      packaging_type: packagingType,
      quantity: qty,
      date,
      note: note.trim() || null,
    })
    setLoading(false)

    if (dbErr) { setError(dbErr.message); return }
    onDone()
  }

  if (!supplier) return null

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="size-4 text-muted-foreground" />
            Return Packaging
          </DialogTitle>
          <DialogDescription>
            Record packaging returned to{" "}
            <span className="font-medium text-foreground">{supplier.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ret-type">Packaging Type</Label>
            <Select value={packagingType} onValueChange={(v) => setPackagingType(v as PackagingType)}>
              <SelectTrigger id="ret-type" className="w-full">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {PACKAGING_TYPES.map((pt) => (
                  <SelectItem key={pt.value} value={pt.value}>
                    {pt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ret-qty">Quantity</Label>
              <Input
                id="ret-qty"
                type="number"
                min="1"
                step="1"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ret-date">Date</Label>
              <Input
                id="ret-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ret-note">Note (optional)</Label>
            <Input
              id="ret-note"
              placeholder="e.g. Returned after cleaning"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Record Return"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
