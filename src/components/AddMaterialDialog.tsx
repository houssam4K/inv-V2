import * as React from "react"
import { PackagePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { UNITS, type UnitOfMeasure } from "@/lib/types"

interface Props {
  onCreated: () => void
}

export function AddMaterialDialog({ onCreated }: Props) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [unit, setUnit] = React.useState<UnitOfMeasure | "">("")
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  function reset() {
    setName("")
    setUnit("")
    setError("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!name.trim()) {
      setError("Name is required.")
      return
    }
    if (!unit) {
      setError("Unit of measure is required.")
      return
    }

    setLoading(true)
    const { error: dbError } = await supabase.from("raw_materials").insert({
      name: name.trim(),
      unit_of_measure: unit,
      current_quantity: 0,
    })
    setLoading(false)

    if (dbError) {
      if (dbError.code === "23505") {
        setError("A material with this name already exists.")
      } else {
        setError(dbError.message)
      }
      return
    }

    reset()
    setOpen(false)
    onCreated()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        setOpen(v)
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <PackagePlus />
          Add Material
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Raw Material</DialogTitle>
          <DialogDescription>
            Create a new raw material to track in inventory.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="mat-name">Name</Label>
            <Input
              id="mat-name"
              placeholder="e.g. PET Preforms 0.5L"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!error && !name.trim()}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="mat-unit">Unit of Measure</Label>
            <Select
              value={unit}
              onValueChange={(v) => setUnit(v as UnitOfMeasure)}
            >
              <SelectTrigger
                id="mat-unit"
                className="w-full"
                aria-invalid={!!error && !unit}
              >
                <SelectValue placeholder="Select unit..." />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset()
                setOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Material"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
