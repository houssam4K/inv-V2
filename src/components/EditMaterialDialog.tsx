import * as React from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight } from "lucide-react"
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
  const [pkgLevel1Label, setPkgLevel1Label] = React.useState("");
  const [pkgLevel1Size, setPkgLevel1Size] = React.useState("");
  const [pkgLevel2Label, setPkgLevel2Label] = React.useState("");
  const [pkgLevel2Size, setPkgLevel2Size] = React.useState("");
  const [showPackaging, setShowPackaging] = React.useState(false);
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (material && open) {
      setName(material.name)
      setUnit(material.unit_of_measure)
      setDailyConsumption(material.daily_consumption?.toString() ?? "")
      setPkgLevel1Label(material.packaging_level1_label ?? "");
      setPkgLevel1Size(material.packaging_level1_size?.toString() ?? "");
      setPkgLevel2Label(material.packaging_level2_label ?? "");
      setPkgLevel2Size(material.packaging_level2_size?.toString() ?? "");
      setShowPackaging(!!material.packaging_level1_label);
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

    const l1s = pkgLevel1Size.trim() !== "" ? parseFloat(pkgLevel1Size) : null;
    const l2s = pkgLevel2Size.trim() !== "" ? parseFloat(pkgLevel2Size) : null;

    if (showPackaging) {
      if (pkgLevel1Label.trim() && !l1s) { setError("Level 1 size is required if label is provided."); return; }
      if (l1s && !pkgLevel1Label.trim()) { setError("Level 1 label is required if size is provided."); return; }
      if ((pkgLevel2Label.trim() || l2s) && (!pkgLevel1Label.trim() || !l1s)) { setError("Level 1 packaging must be configured to use Level 2."); return; }
      if (pkgLevel2Label.trim() && !l2s) { setError("Level 2 size is required if label is provided."); return; }
      if (l2s && !pkgLevel2Label.trim()) { setError("Level 2 label is required if size is provided."); return; }
      if (l1s !== null && l1s <= 0) { setError("Level 1 size must be positive."); return; }
      if (l2s !== null && l2s <= 0) { setError("Level 2 size must be positive."); return; }
    }

    setLoading(true)

    const updateData: any = { 
      name: name.trim(), 
      unit_of_measure: unit, 
      daily_consumption: dc,
      packaging_level1_label: null,
      packaging_level1_size: null,
      packaging_level2_label: null,
      packaging_level2_size: null,
    };

    if (showPackaging && pkgLevel1Label.trim() && l1s) {
      updateData.packaging_level1_label = pkgLevel1Label.trim();
      updateData.packaging_level1_size = l1s;
      if (pkgLevel2Label.trim() && l2s) {
        updateData.packaging_level2_label = pkgLevel2Label.trim();
        updateData.packaging_level2_size = l2s;
      }
    }

    const { data, error: dbErr } = await supabase
      .from("raw_materials")
      .update(updateData)
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

          <div className="flex flex-col gap-2 rounded-md border p-3 bg-muted/20">
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors text-left"
              onClick={() => setShowPackaging(!showPackaging)}
            >
              {showPackaging ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Packaging Configuration (Display Only)
            </button>
            {showPackaging && (
              <div className="flex flex-col gap-4 mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <p className="text-xs text-muted-foreground">
                  This is only used to show a converted count on the material page. It does not affect stock movements or calculations.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="epkg-l1-label" className="text-xs">Level 1 Label</Label>
                    <Input id="epkg-l1-label" placeholder="e.g. Carton" value={pkgLevel1Label} onChange={e => setPkgLevel1Label(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="epkg-l1-size" className="text-xs">Base units per L1</Label>
                    <Input id="epkg-l1-size" type="number" min="1" step="any" placeholder="e.g. 6000" value={pkgLevel1Size} onChange={e => setPkgLevel1Size(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="epkg-l2-label" className="text-xs">Level 2 Label (optional)</Label>
                    <Input id="epkg-l2-label" placeholder="e.g. Pallet" value={pkgLevel2Label} onChange={e => setPkgLevel2Label(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="epkg-l2-size" className="text-xs">L1 units per L2</Label>
                    <Input id="epkg-l2-size" type="number" min="1" step="any" placeholder="e.g. 30" value={pkgLevel2Size} onChange={e => setPkgLevel2Size(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
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
