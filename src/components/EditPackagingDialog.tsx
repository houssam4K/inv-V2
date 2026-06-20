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
import { PACKAGING_TYPES, type PackagingTransaction, type PackagingType } from "@/lib/types"

interface Props {
  transaction: PackagingTransaction | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function EditPackagingDialog({ transaction, open, onClose, onSaved }: Props) {
  const [transactionType, setTransactionType] = React.useState<"SENT" | "RETURNED">("SENT")
  const [packagingType, setPackagingType] = React.useState<PackagingType>("box")
  const [quantity, setQuantity] = React.useState("")
  const [date, setDate] = React.useState("")
  const [note, setNote] = React.useState("")
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (transaction && open) {
      setTransactionType(transaction.transaction_type)
      setPackagingType(transaction.packaging_type)
      setQuantity(transaction.quantity.toString())
      setDate(transaction.date.slice(0, 10))
      setNote(transaction.note ?? "")
      setError("")
    }
  }, [transaction, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    const qty = parseInt(quantity, 10)
    if (isNaN(qty) || qty <= 0) { setError("Quantity must be a positive integer."); return }
    if (!date) { setError("Date is required."); return }

    setLoading(true)

    const { error: pkgErr } = await supabase
      .from("packaging_transactions")
      .update({
        transaction_type: transactionType,
        packaging_type: packagingType,
        quantity: qty,
        date: new Date(date).toISOString(),
        note: note.trim() || null,
      })
      .eq("id", transaction!.id)

    setLoading(false)

    if (pkgErr) { setError(pkgErr.message); return }
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Packaging Transaction</DialogTitle>
          <DialogDescription>
            Update the details of this packaging record.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Type</Label>
              <Select value={transactionType} onValueChange={(v) => setTransactionType(v as "SENT" | "RETURNED")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="RETURNED">Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Packaging</Label>
              <Select value={packagingType} onValueChange={(v) => setPackagingType(v as PackagingType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PACKAGING_TYPES.map((pt) => (
                    <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="epkg-qty">Quantity</Label>
              <Input
                id="epkg-qty"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="epkg-date">Date</Label>
              <Input
                id="epkg-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="epkg-note">Note (optional)</Label>
            <Textarea
              id="epkg-note"
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
