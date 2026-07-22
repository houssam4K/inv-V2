import * as React from "react"
import { Calculator } from "lucide-react"
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
import { supabase } from "@/lib/supabase"
import { PACKAGING_TYPES, type Supplier, type PackagingType } from "@/lib/types"

interface Props {
  supplier: Supplier | null
  packagingType: PackagingType | null
  currentBalance: number
  open: boolean
  onClose: () => void
  onDone: () => void
}

export function SetPackagingCountDialog({ supplier, packagingType, currentBalance, open, onClose, onDone }: Props) {
  const [actualQuantity, setActualQuantity] = React.useState("")
  const [date, setDate] = React.useState("")
  const [note, setNote] = React.useState("Physical count / opening balance")
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setActualQuantity(currentBalance === 0 ? "" : currentBalance.toString())
      setDate(new Date().toISOString().slice(0, 10))
      setNote("Physical count / opening balance")
      setError("")
    }
  }, [open, currentBalance])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!date) { setError("Date is required."); return }
    
    const actualQty = parseInt(actualQuantity, 10)
    if (isNaN(actualQty)) {
      setError("Please enter a valid quantity.")
      return
    }

    const delta = actualQty - currentBalance

    if (delta === 0) {
      // Nothing to do
      onClose()
      return
    }

    setLoading(true)
    const { error: dbErr } = await supabase.from("packaging_transactions").insert({
      supplier_id: supplier!.id,
      transaction_type: "ADJUSTMENT",
      packaging_type: packagingType!,
      quantity: delta,
      date,
      note: note.trim() || null,
    })
    setLoading(false)

    if (dbErr) { setError(dbErr.message); return }
    onDone()
  }

  if (!supplier || !packagingType) return null

  const pkgLabel = PACKAGING_TYPES.find((pt) => pt.value === packagingType)?.label || packagingType

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="size-4 text-muted-foreground" />
            Set Current Count
          </DialogTitle>
          <DialogDescription>
            Update the actual quantity on hand for{" "}
            <span className="font-medium text-foreground">{pkgLabel.toLowerCase()}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current calculated balance</span>
              <span className="text-sm font-medium">{currentBalance}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="actual-qty" className="text-sm font-semibold text-foreground whitespace-nowrap">
                Actual quantity on hand
              </Label>
              <Input
                id="actual-qty"
                type="number"
                step="1"
                placeholder="0"
                value={actualQuantity}
                onChange={(e) => setActualQuantity(e.target.value)}
                className="w-24 h-8 text-right font-medium"
              />
            </div>
            
            {actualQuantity !== "" && !isNaN(parseInt(actualQuantity, 10)) && (
              <div className="flex items-center justify-between text-xs pt-1 border-t mt-1">
                <span className="text-muted-foreground">Adjustment delta</span>
                <span className={`font-semibold ${parseInt(actualQuantity, 10) - currentBalance > 0 ? 'text-emerald-600 dark:text-emerald-400' : parseInt(actualQuantity, 10) - currentBalance < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {parseInt(actualQuantity, 10) - currentBalance > 0 ? '+' : ''}{parseInt(actualQuantity, 10) - currentBalance}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="adj-date">Date</Label>
              <Input
                id="adj-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="adj-note">Note (optional)</Label>
              <Input
                id="adj-note"
                placeholder="e.g. Physical count / opening balance"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Apply Adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
