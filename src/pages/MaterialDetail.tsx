import * as React from "react";
import {
  ArrowDownCircle,
  ArrowLeft,
  ArrowUpCircle,
  CalendarDays,
  Clock,
  Edit2,
  FileText,
  MoreHorizontal,
  Package,
  Pencil,
  Trash2,
  TrendingDown,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";
import { EditStockMovementDialog } from "@/components/EditStockMovementDialog";
import { supabase } from "@/lib/supabase";
import { type RawMaterial, type StockMovement } from "@/lib/types";

interface Props {
  material: RawMaterial;
  onBack: () => void;
  onUpdated: (updated: RawMaterial) => void;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-DZ", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtMonth(mk: string) {
  const [y, m] = mk.split("-").map(Number);
  return new Date(y, m - 1).toLocaleDateString("fr-DZ", {
    year: "numeric",
    month: "long",
  });
}

// ---------- Forecast chart ----------

const CHART_CONFIG = {
  stock: { label: "Stock", color: "var(--chart-1)" },
};

function ForecastChart({
  currentStock,
  dailyConsumption,
  unit,
}: {
  currentStock: number;
  dailyConsumption: number;
  unit: string;
}) {
  const today = new Date();
  const data = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const label = d.toLocaleDateString("fr-DZ", {
      day: "numeric",
      month: "short",
    });
    return {
      day: label,
      stock: Math.max(0, currentStock - dailyConsumption * i),
    };
  });

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">7-Day Stock Forecast</p>
        <span className="text-xs text-muted-foreground">
          −{dailyConsumption} {unit}/day
        </span>
      </div>
      <ChartContainer config={CHART_CONFIG} className="min-h-[160px] w-full">
        <BarChart
          data={data}
          margin={{ top: 20, right: 8, left: 8, bottom: 0 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
          />
          <YAxis hide />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Bar dataKey="stock" fill="var(--color-stock)" radius={[4, 4, 0, 0]}>
            <LabelList
              dataKey="stock"
              position="top"
              style={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}

// ---------- Edit daily consumption ----------

function EditDailyConsumption({
  material,
  onSaved,
}: {
  material: RawMaterial;
  onSaved: (updated: RawMaterial) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(
    material.daily_consumption?.toString() ?? "",
  );
  const [saving, setSaving] = React.useState(false);

  async function save() {
    const dc = value.trim() !== "" ? parseFloat(value) : null;
    if (dc !== null && (isNaN(dc) || dc < 0)) return;
    setSaving(true);
    const { error } = await supabase
      .from("raw_materials")
      .update({ daily_consumption: dc })
      .eq("id", material.id);
    setSaving(false);
    if (!error) {
      setEditing(false);
      onSaved({ ...material, daily_consumption: dc });
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min="0"
          step="any"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-7 w-28 text-sm tabular-nums"
          autoFocus
        />
        <span className="text-xs text-muted-foreground">
          {material.unit_of_measure}/day
        </span>
        <Button
          size="sm"
          className="h-7 text-xs px-2.5"
          onClick={save}
          disabled={saving}
        >
          {saving ? "..." : "Save"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs px-2"
          onClick={() => setEditing(false)}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm tabular-nums font-medium">
        {material.daily_consumption != null ? (
          `${material.daily_consumption} ${material.unit_of_measure}/day`
        ) : (
          <span className="text-muted-foreground text-xs">Not set</span>
        )}
      </span>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0"
        onClick={() => setEditing(true)}
      >
        <Edit2 className="size-3" />
      </Button>
    </div>
  );
}

// ---------- Main page ----------

interface MovementWithBalance extends StockMovement {
  balanceAfter: number;
}

export function MaterialDetail({
  material: initialMaterial,
  onBack,
  onUpdated,
}: Props) {
  const [material, setMaterial] = React.useState(initialMaterial);
  const [allMovements, setAllMovements] = React.useState<MovementWithBalance[]>(
    [],
  );
  const [loading, setLoading] = React.useState(true);
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [editMovement, setEditMovement] =
    React.useState<MovementWithBalance | null>(null);
  const [deleteMovementTarget, setDeleteMovementTarget] =
    React.useState<MovementWithBalance | null>(null);
  const [deletingMovement, setDeletingMovement] = React.useState(false);



  async function loadMovements(freshQty?: number) {
    setLoading(true);
    let currentQty =
      freshQty !== undefined ? freshQty : Number(material.current_quantity);
      
    if (freshQty === undefined) {
      const { data: freshMat } = await supabase
        .from("raw_materials")
        .select("current_quantity")
        .eq("id", material.id)
        .single();
      if (freshMat) {
        currentQty = Number(freshMat.current_quantity);
      }
    }

    const { data, error } = await supabase
      .from("stock_movements")
      .select("*")
      .eq("raw_material_id", material.id)
      .order("date", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      console.error("Failed to load movements:", error);
      setAllMovements([]);
      setLoading(false);
      return;
    }

    const movements = (data as StockMovement[]) ?? [];

    const totalDelta = movements.reduce(
      (acc, m) =>
        acc +
        (m.movement_type === "IN" ? Number(m.quantity) : -Number(m.quantity)),
      0,
    );
    const baseStock = currentQty - totalDelta;

    // Compute running balance forward from baseStock
    let balance = baseStock;
    const withBalance: MovementWithBalance[] = movements.map((m) => {
      if (m.movement_type === "IN") balance += Number(m.quantity);
      else balance -= Number(m.quantity);
      return { ...m, balanceAfter: balance };
    });

    setAllMovements(withBalance);
    setLoading(false);
  }

  async function reloadMaterial() {
    const { data } = await supabase
      .from("raw_materials")
      .select("*")
      .eq("id", material.id)
      .single();
    if (data) {
      const mat = { ...data, current_quantity: Number(data.current_quantity) } as RawMaterial;
      setMaterial(mat);
      onUpdated(mat);
      return mat;
    }
    return null;
  }

  React.useEffect(() => {
    loadMovements();
  }, [material.id]);

  // Available months from all movements
  const availableMonths = React.useMemo(() => {
    const set = new Set<string>();
    for (const m of allMovements) set.add(monthKey(m.date));
    const sorted = Array.from(set).sort((a, b) => b.localeCompare(a));
    return sorted;
  }, [allMovements]);

  // Ensure currentMonth is valid
  const hasInitialized = React.useRef(false);
  React.useEffect(() => {
    hasInitialized.current = false;
  }, [material.id]);

  React.useEffect(() => {
    if (availableMonths.length > 0 && !hasInitialized.current) {
      if (!availableMonths.includes(currentMonth)) {
        setCurrentMonth(availableMonths[0]);
      }
      hasInitialized.current = true;
    }
  }, [availableMonths]);

  // Movements in current month - sorted newest first (reverse chronologically by date)
  // Within same day, keep chronological order (ascending by date/time)
  const monthMovements = React.useMemo(() => {
    const filtered = allMovements.filter(
      (m) => monthKey(m.date) === currentMonth,
    );
    // Sort by date descending (newest first)
    // Within same date, keep original order (which is chronological)
    return [...filtered].sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      // Same date - maintain deterministic order (id descending to match newest first)
      return b.id.localeCompare(a.id);
    });
  }, [allMovements, currentMonth]);

  // Stock at start of selected month (balance before first movement of month)
  const stockAtStartOfMonth = React.useMemo(() => {
    const chronMovements = allMovements.filter(
      (m) => monthKey(m.date) === currentMonth,
    );

    if (chronMovements.length > 0) {
      const firstOfMonth = chronMovements[0];
      const startStock = firstOfMonth.balanceAfter -
        (firstOfMonth.movement_type === "IN"
          ? Number(firstOfMonth.quantity)
          : -Number(firstOfMonth.quantity));
      return Number(startStock.toFixed(2));
    }

    // If no movements this month, find the last movement BEFORE this month
    const priorMovements = allMovements.filter(
      (m) => monthKey(m.date) < currentMonth,
    );
    if (priorMovements.length > 0) {
      return Number(priorMovements[priorMovements.length - 1].balanceAfter.toFixed(2));
    }

    // No prior movements.
    // Calculate total delta from all movements to find baseStock
    const totalDelta = allMovements.reduce(
      (acc, m) =>
        acc +
        (m.movement_type === "IN" ? Number(m.quantity) : -Number(m.quantity)),
      0,
    );
    return Number((Number(material.current_quantity) - totalDelta).toFixed(2));
  }, [allMovements, currentMonth, material.current_quantity]);

  // Group movements by day for the table display (newest day first)
  const byDay = React.useMemo(() => {
    const map = new Map<string, MovementWithBalance[]>();
    for (const m of monthMovements) {
      const key = m.date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries());
  }, [monthMovements]);

  const { totalIn, totalOut } = React.useMemo(() => {
    const inMonth = allMovements.filter(
      (m) => monthKey(m.date) === currentMonth,
    );
    return {
      totalIn: inMonth
        .filter((m) => m.movement_type === "IN")
        .reduce((a, m) => a + Number(m.quantity), 0),
      totalOut: inMonth
        .filter((m) => m.movement_type === "OUT")
        .reduce((a, m) => a + Number(m.quantity), 0),
    };
  }, [allMovements, currentMonth]);

  async function handleDeleteMovement() {
    if (!deleteMovementTarget) return;
    setDeletingMovement(true);

    const { error: delErr } = await supabase
      .from("stock_movements")
      .delete()
      .eq("id", deleteMovementTarget.id);

    if (!delErr) {
      const freshMat = await reloadMaterial();
      await loadMovements(freshMat?.current_quantity);
    }

    setDeletingMovement(false);
    setDeleteMovementTarget(null);
  }

  // Jours restants
  const joursRestants =
    material.daily_consumption != null &&
    material.daily_consumption > 0 &&
    material.current_quantity != null
      ? Math.floor(
          Number(material.current_quantity) /
            Number(material.daily_consumption),
        )
      : null;

  function handleUpdated(updated: RawMaterial) {
    setMaterial(updated);
    onUpdated(updated);
  }

  function prevMonth() {
    const [y, m] = currentMonth.split("-").map(Number);
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    setCurrentMonth(`${py}-${String(pm).padStart(2, "0")}`);
  }

  function nextMonth() {
    const [y, m] = currentMonth.split("-").map(Number);
    const nm = m === 12 ? 1 : m + 1;
    const ny = m === 12 ? y + 1 : y;
    setCurrentMonth(`${ny}-${String(nm).padStart(2, "0")}`);
  }

  let packagingDisplay: React.ReactNode = null;
  if (material.packaging_level1_label && material.packaging_level1_size) {
    const l1s = material.packaging_level1_size;
    const l2s = material.packaging_level2_size;
    const l2label = material.packaging_level2_label;
    const qty = material.current_quantity;

    let displayString = "";
    let subtext = "";

    if (l2s && l2label) {
      const unitsPerLevel2 = l1s * l2s;
      const level2Count = Math.floor(qty / unitsPerLevel2);
      const remainderAfterLevel2 = qty - level2Count * unitsPerLevel2;
      const level1Count = Math.floor(remainderAfterLevel2 / l1s);
      const remainder = Number((remainderAfterLevel2 - level1Count * l1s).toFixed(2));
      
      displayString = `${level2Count} ${l2label}(s) · ${level1Count} ${material.packaging_level1_label}(s)`;
      subtext = `+${remainder} ${material.unit_of_measure}`;
    } else {
      const level1Count = Math.floor(qty / l1s);
      const remainder = Number((qty - level1Count * l1s).toFixed(2));
      displayString = `${level1Count} ${material.packaging_level1_label}(s)`;
      subtext = `+${remainder} ${material.unit_of_measure}`;
    }

    packagingDisplay = (
      <div className="rounded-xl border bg-card px-4 py-3">
        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
          <Package className="size-3" />
          Packaging
        </div>
        <div className="text-sm font-semibold truncate" title={displayString}>
          {displayString}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {subtext}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="-ml-1 mt-0.5 shrink-0"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Package className="size-6 text-muted-foreground" />
            {material.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {material.unit_of_measure}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="rounded-xl border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground mb-1">
            Current Stock
          </div>
          <div className="text-xl font-semibold tabular-nums">
            {material.current_quantity}
          </div>
          <div className="text-xs text-muted-foreground">
            {material.unit_of_measure}
          </div>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <TrendingDown className="size-3" />
            Consommation/jour
          </div>
          <EditDailyConsumption material={material} onSaved={handleUpdated} />
        </div>
        {joursRestants !== null && (
          <div
            className={`rounded-xl border px-4 py-3 ${joursRestants <= 3 ? "bg-destructive/10 border-destructive/30" : joursRestants <= 7 ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900" : "bg-card"}`}
          >
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <CalendarDays className="size-3" />
              Jours restants
            </div>
            <div
              className={`text-xl font-semibold tabular-nums ${joursRestants <= 3 ? "text-destructive" : joursRestants <= 7 ? "text-amber-700 dark:text-amber-400" : ""}`}
            >
              {joursRestants}
            </div>
            <div className="text-xs text-muted-foreground">days</div>
          </div>
        )}
        <div className="rounded-xl border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Clock className="size-3" />
            Total movements
          </div>
          <div className="text-xl font-semibold">{allMovements.length}</div>
        </div>
        {packagingDisplay}
      </div>

      {/* Forecast chart */}
      {material.daily_consumption != null && material.daily_consumption > 0 && (
        <ForecastChart
          currentStock={material.current_quantity}
          dailyConsumption={material.daily_consumption}
          unit={material.unit_of_measure}
        />
      )}

      <Separator />

      {/* Month navigation */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold">Movement History</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth}>
            &larr;
          </Button>
          <span className="text-sm font-medium min-w-[160px] text-center">
            {fmtMonth(currentMonth)}
          </span>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            &rarr;
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          {/* Month summary row */}
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="rounded-lg border bg-card px-3 py-2 flex items-center gap-2">
              <span className="text-muted-foreground text-xs">
                Stock at start
              </span>
              <span className="font-semibold tabular-nums">
                {stockAtStartOfMonth}
              </span>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2 flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <ArrowUpCircle className="size-3.5" />
              <span className="tabular-nums font-medium">+{totalIn}</span>
              <span className="text-xs text-muted-foreground">received</span>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2 flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <ArrowDownCircle className="size-3.5" />
              <span className="tabular-nums font-medium">−{totalOut}</span>
              <span className="text-xs text-muted-foreground">consumed</span>
            </div>
          </div>

          {/* Movements table */}
          {monthMovements.length === 0 ? (
            <div className="rounded-xl border bg-card flex flex-col items-center justify-center py-16 text-center">
              <CalendarDays className="size-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No movements in {fmtMonth(currentMonth)}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Stock After</TableHead>
                    <TableHead>Source / Note</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Group by day */}
                  {byDay.map(([day, items]) => (
                    <React.Fragment key={day}>
                      {/* Day separator row */}
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={6} className="py-1.5">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {fmtDate(day + "T12:00:00")}
                          </span>
                        </TableCell>
                      </TableRow>
                      {items.map((mov) => {
                        const isIn = mov.movement_type === "IN";
                        return (
                          <TableRow key={mov.id}>
                            <TableCell className="text-sm text-muted-foreground">
                              {fmtDate(mov.date)}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-medium ${isIn ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}
                              >
                                {isIn ? (
                                  <ArrowUpCircle className="size-3.5" />
                                ) : (
                                  <ArrowDownCircle className="size-3.5" />
                                )}
                                {isIn ? "Received" : "Consumed"}
                              </span>
                            </TableCell>
                            <TableCell
                              className={`text-right tabular-nums font-semibold ${isIn ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}
                            >
                              {isIn ? "+" : "−"}
                              {mov.quantity}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium text-sm">
                              {mov.balanceAfter}
                              <span className="text-muted-foreground font-normal ml-1 text-xs">
                                {material.unit_of_measure}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {mov.supplier_name && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs font-normal gap-1 shrink-0"
                                  >
                                    <Truck className="size-3" />
                                    {mov.supplier_name}
                                  </Badge>
                                )}
                                {mov.invoice_number && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs font-mono font-normal gap-1 shrink-0"
                                  >
                                    <FileText className="size-3" />
                                    {mov.invoice_number}
                                  </Badge>
                                )}
                                {mov.note && (
                                  <span className="text-xs text-muted-foreground truncate">
                                    {mov.note}
                                  </span>
                                )}
                                {!mov.supplier_name &&
                                  !mov.invoice_number &&
                                  !mov.note && (
                                    <span className="text-xs text-muted-foreground">
                                      —
                                    </span>
                                  )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="size-7 p-0"
                                  >
                                    <MoreHorizontal className="size-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => setEditMovement(mov)}
                                  >
                                    <Pencil className="size-3.5 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setDeleteMovementTarget(mov)}
                                  >
                                    <Trash2 className="size-3.5 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Edit movement dialog */}
      <EditStockMovementDialog
        movement={
          editMovement
            ? { ...editMovement, materialUnit: material.unit_of_measure }
            : null
        }
        open={!!editMovement}
        onClose={() => setEditMovement(null)}
        onSaved={async () => {
          setEditMovement(null);
          const { data: mat } = await supabase
            .from("raw_materials")
            .select("current_quantity")
            .eq("id", material.id)
            .single();
          await loadMovements(mat ? Number(mat.current_quantity) : undefined);
          await reloadMaterial();
        }}
      />

      {/* Delete movement confirmation */}
      <AlertDialog
        open={!!deleteMovementTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteMovementTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this movement?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the{" "}
              <strong>
                {deleteMovementTarget?.movement_type === "IN"
                  ? "Received"
                  : "Consumed"}{" "}
                {deleteMovementTarget?.quantity} {material.unit_of_measure}
              </strong>{" "}
              movement from{" "}
              {deleteMovementTarget ? fmtDate(deleteMovementTarget.date) : ""}.
              Stock quantity will be adjusted accordingly. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteMovement}
              disabled={deletingMovement}
            >
              {deletingMovement ? "Deleting..." : "Delete Movement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
