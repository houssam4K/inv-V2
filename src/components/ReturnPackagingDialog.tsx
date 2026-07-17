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
import { supabase } from "@/lib/supabase"
import { PACKAGING_TYPES, type Supplier } from "@/lib/types"

interface Props {
  supplier: Supplier | null
  open: boolean
  onClose: () => void
  onDone: () => void
}

export function ReturnPackagingDialog({ supplier, open, onClose, onDone }: Props) {
  const [qtys, setQtys] = React.useState<Record<string, string>>({ box: "", pallet: "", mandrin: "" })
  const [date, setDate] = React.useState("")
  const [note, setNote] = React.useState("")
  const [bonNumber, setBonNumber] = React.useState("")
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setQtys({ box: "", pallet: "", mandrin: "" })
      setDate(new Date().toISOString().slice(0, 10))
      setNote("")
      setBonNumber("")
      setError("")
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!date) { setError("Date is required."); return }

    const batchId = crypto.randomUUID()
    const inserts = PACKAGING_TYPES
      .filter((pt) => {
        const v = parseInt(qtys[pt.value] ?? "", 10)
        return !isNaN(v) && v > 0
      })
      .map((pt) => ({
        supplier_id: supplier!.id,
        transaction_type: "RETURNED" as const,
        packaging_type: pt.value,
        quantity: parseInt(qtys[pt.value], 10),
        date,
        note: note.trim() || null,
        bon_number: bonNumber.trim() || null,
        batch_id: batchId,
      }))

    if (inserts.length === 0) {
      setError("Enter at least one packaging quantity.")
      return
    }

    setLoading(true)
    const { error: dbErr } = await supabase.from("packaging_transactions").insert(inserts)
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
          {/* All packaging types at once */}
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
            {PACKAGING_TYPES.map((pt) => (
              <div key={pt.value} className="flex items-center gap-3">
                <Label className="min-w-[70px] text-sm">{pt.label}</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={qtys[pt.value] ?? ""}
                  onChange={(e) =>
                    setQtys((prev) => ({ ...prev, [pt.value]: e.target.value }))
                  }
                  className="flex-1 h-8"
                />
                <span className="text-xs text-muted-foreground shrink-0 min-w-[60px]">
                  {pt.value === "box" ? "boxes" : pt.value === "pallet" ? "pallets" : "mandrins"}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ret-date">Date</Label>
              <Input
                id="ret-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ret-note">Note (optional)</Label>
              <Input
                id="ret-note"
                placeholder="e.g. After cleaning"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 col-span-2">
              <Label htmlFor="ret-bon">N° Bon (optionnel)</Label>
              <Input
                id="ret-bon"
                placeholder="e.g. BR-1234"
                value={bonNumber}
                onChange={(e) => setBonNumber(e.target.value)}
              />
            </div>
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
