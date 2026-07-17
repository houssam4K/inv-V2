import * as React from "react";
import { PackagePlus, ChevronDown, ChevronRight } from "lucide-react";
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
  const [pkgLevel1Label, setPkgLevel1Label] = React.useState("");
  const [pkgLevel1Size, setPkgLevel1Size] = React.useState("");
  const [pkgLevel2Label, setPkgLevel2Label] = React.useState("");
  const [pkgLevel2Size, setPkgLevel2Size] = React.useState("");
  const [showPackaging, setShowPackaging] = React.useState(false);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  function reset() {
    setName("");
    setUnit("");
    setOpeningStock("");
    setDailyConsumption("");
    setPkgLevel1Label("");
    setPkgLevel1Size("");
    setPkgLevel2Label("");
    setPkgLevel2Size("");
    setShowPackaging(false);
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

    setLoading(true);

    const insertData: any = {
      name: name.trim(),
      unit_of_measure: unit,
      current_quantity: 0,
      daily_consumption: dc,
    };

    if (showPackaging && pkgLevel1Label.trim() && l1s) {
      insertData.packaging_level1_label = pkgLevel1Label.trim();
      insertData.packaging_level1_size = l1s;
      if (pkgLevel2Label.trim() && l2s) {
        insertData.packaging_level2_label = pkgLevel2Label.trim();
        insertData.packaging_level2_size = l2s;
      }
    }

    const { data: matData, error: dbError } = await supabase
      .from("raw_materials")
      .insert(insertData)
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
    if (os > 0) {
      await supabase.from("stock_movements").insert({
        raw_material_id: matData.id,
        movement_type: "IN",
        quantity: os,
        note: "Opening balance",
      });
    }

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
                    <Label htmlFor="pkg-l1-label" className="text-xs">Level 1 Label</Label>
                    <Input id="pkg-l1-label" placeholder="e.g. Carton" value={pkgLevel1Label} onChange={e => setPkgLevel1Label(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="pkg-l1-size" className="text-xs">Base units per L1</Label>
                    <Input id="pkg-l1-size" type="number" min="1" step="any" placeholder="e.g. 6000" value={pkgLevel1Size} onChange={e => setPkgLevel1Size(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="pkg-l2-label" className="text-xs">Level 2 Label (optional)</Label>
                    <Input id="pkg-l2-label" placeholder="e.g. Pallet" value={pkgLevel2Label} onChange={e => setPkgLevel2Label(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="pkg-l2-size" className="text-xs">L1 units per L2</Label>
                    <Input id="pkg-l2-size" type="number" min="1" step="any" placeholder="e.g. 30" value={pkgLevel2Size} onChange={e => setPkgLevel2Size(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
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
