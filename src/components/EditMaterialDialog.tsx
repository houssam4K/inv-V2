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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { UNITS, type RawMaterial, type UnitOfMeasure } from "@/lib/types"

interface Props {
  material: RawMaterial | null
  open: boolean
  onClose: () => void
  onSaved: (updated: RawMaterial) => void
}

export function EditMaterialDialog({ material, open, onClose, onSaved }: Props) {
  const [name, setName] = React.useState("")
  const [unit, setUnit] = React.useState<UnitOfMeasure | "">("")
  const [dailyConsumption, setDailyConsumption] = React.useState("")
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (material && open) {
      setName(material.name)
      setUnit(material.unit_of_measure)
      setDailyConsumption(material.daily_consumption?.toString() ?? "")
      setError("")
    }
  }, [material, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!name.trim()) { setError("Name is required."); return }
    if (!unit) { setError("Unit of measure is required."); return }

    const dc = dailyConsumption.trim() !== "" ? parseFloat(dailyConsumption) : null
    if (dc !== null && (isNaN(dc) || dc < 0)) {
      setError("Daily consumption must be a positive number.")
      return
    }

    setLoading(true)
    const { data, error: dbErr } = await supabase
      .from("raw_materials")
      .update({ name: name.trim(), unit_of_measure: unit, daily_consumption: dc })
      .eq("id", material!.id)
      .select()
      .single()
    setLoading(false)

    if (dbErr) {
      setError(dbErr.code === "23505" ? "A material with this name already exists." : dbErr.message)
      return
    }
    onSaved(data as RawMaterial)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Material</DialogTitle>
          <DialogDescription>Update the material details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="emat-name">Name</Label>
            <Input id="emat-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="emat-unit">Unit of Measure</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as UnitOfMeasure)}>
              <SelectTrigger id="emat-unit" className="w-full">
                <SelectValue placeholder="Select unit..." />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="emat-dc">
              Consommation par jour{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="emat-dc"
              type="number"
              min="0"
              step="any"
              placeholder="e.g. 500"
              value={dailyConsumption}
              onChange={(e) => setDailyConsumption(e.target.value)}
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
