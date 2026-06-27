import * as React from "react";
import { PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { UNITS, type UnitOfMeasure } from "@/lib/types";

interface Props {
  onCreated: () => void;
}

export function AddMaterialDialog({ onCreated }: Props) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [unit, setUnit] = React.useState<UnitOfMeasure | "">("");
  const [openingStock, setOpeningStock] = React.useState("");
  const [dailyConsumption, setDailyConsumption] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  function reset() {
    setName("");
    setUnit("");
    setOpeningStock("");
    setDailyConsumption("");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!unit) {
      setError("Unit of measure is required.");
      return;
    }

    const os = openingStock.trim() !== "" ? parseFloat(openingStock) : 0;
    if (isNaN(os) || os < 0) {
      setError("Opening stock must be 0 or more.");
      return;
    }

    const dc =
      dailyConsumption.trim() !== "" ? parseFloat(dailyConsumption) : null;
    if (dc !== null && (isNaN(dc) || dc < 0)) {
      setError("Daily consumption must be a positive number.");
      return;
    }

    setLoading(true);

    const { data: matData, error: dbError } = await supabase
      .from("raw_materials")
      .insert({
        name: name.trim(),
        unit_of_measure: unit,
        current_quantity: os,
        daily_consumption: dc,
      })
      .select("id")
      .single();

    if (dbError) {
      setLoading(false);
      if (dbError.code === "23505") {
        setError("A material with this name already exists.");
      } else {
        setError(dbError.message);
      }
      return;
    }

    // Record opening stock as an initial stock movement

    setLoading(false);
    reset();
    setOpen(false);
    onCreated();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        setOpen(v);
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="mat-os">
              Stock initial{" "}
              <span className="text-muted-foreground font-normal">
                (optional, default 0)
              </span>
            </Label>
            <Input
              id="mat-os"
              type="number"
              min="0"
              step="any"
              placeholder="e.g. 5000"
              value={openingStock}
              onChange={(e) => setOpeningStock(e.target.value)}
            />
            <p className="text-xs text-muted-foreground -mt-1">
              Current quantity you already have in stock.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="mat-dc">
              Consommation par jour{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="mat-dc"
              type="number"
              min="0"
              step="any"
              placeholder="e.g. 500"
              value={dailyConsumption}
              onChange={(e) => setDailyConsumption(e.target.value)}
            />
            <p className="text-xs text-muted-foreground -mt-1">
              Used to calculate days remaining and forecast stock.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                setOpen(false);
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
  );
}
