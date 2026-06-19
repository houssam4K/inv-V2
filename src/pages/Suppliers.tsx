import * as React from "react"
import {
  ArrowLeft,
  Building2,
  FileDown,
  Mail,
  Package,
  Phone,
  RotateCcw,
  Truck,
  User,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { AddSupplierDialog } from "@/components/AddSupplierDialog"
import { NewShipmentDialog } from "@/components/NewShipmentDialog"
import { ReturnPackagingDialog } from "@/components/ReturnPackagingDialog"
import { supabase } from "@/lib/supabase"
import {
  PACKAGING_TYPES,
  type PackagingTransaction,
  type Supplier,
} from "@/lib/types"
import { exportPackagingPDF } from "@/lib/pdf"

interface ShipmentRow {
  id: string
  date: string
  raw_material_id: string
  quantity: number
  unit_price: number
  invoice_number: string | null
  note: string | null
  raw_materials: { name: string; unit_of_measure: string }
}

interface SupplierWithStats extends Supplier {
  totalSpend: number
  shipmentCount: number
  lastShipmentDate: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatCurrency(n: number) {
  return n.toLocaleString() + " DA"
}

// ---------- Supplier List ----------

interface ListProps {
  onSelect: (supplier: Supplier) => void
}

function SupplierList({ onSelect }: ListProps) {
  const [suppliers, setSuppliers] = React.useState<SupplierWithStats[]>([])
  const [loading, setLoading] = React.useState(true)

  async function load() {
    const [supRes, shipRes] = await Promise.all([
      supabase.from("suppliers").select("*").order("name"),
      supabase.from("shipments").select("supplier_id, quantity, unit_price, date"),
    ])

    const supList = (supRes.data as Supplier[]) ?? []
    const shipList = (shipRes.data as { supplier_id: string; quantity: number; unit_price: number; date: string }[]) ?? []

    const withStats: SupplierWithStats[] = supList.map((s) => {
      const rows = shipList.filter((r) => r.supplier_id === s.id)
      const totalSpend = rows.reduce((acc, r) => acc + r.quantity * r.unit_price, 0)
      const lastShipmentDate = rows.length
        ? rows.sort((a, b) => b.date.localeCompare(a.date))[0].date
        : null
      return { ...s, totalSpend, shipmentCount: rows.length, lastShipmentDate }
    })

    setSuppliers(withStats)
    setLoading(false)
  }

  React.useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (suppliers.length === 0) {
    return (
      <div className="rounded-xl border bg-card">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>No suppliers yet</EmptyTitle>
            <EmptyDescription>Add your first supplier to track deliveries and packaging.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {suppliers.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s)}
          className="text-left rounded-xl border bg-card px-5 py-4 hover:bg-accent/50 transition-colors w-full group"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                <span className="font-semibold text-base group-hover:text-primary transition-colors">
                  {s.name}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-0.5">
                {s.contact_person && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="size-3" />
                    {s.contact_person}
                  </span>
                )}
                {s.phone && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="size-3" />
                    {s.phone}
                  </span>
                )}
                {s.email && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="size-3" />
                    {s.email}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <div className="text-sm font-semibold tabular-nums">{formatCurrency(s.totalSpend)}</div>
                <div className="text-xs text-muted-foreground">total spend</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{s.shipmentCount}</div>
                <div className="text-xs text-muted-foreground">shipments</div>
              </div>
              {s.lastShipmentDate && (
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-medium">{formatDate(s.lastShipmentDate)}</div>
                  <div className="text-xs text-muted-foreground">last delivery</div>
                </div>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

// ---------- Packaging Balance ----------

interface PackagingBalance {
  type: string
  label: string
  sent: number
  returned: number
  balance: number
}

function PackagingBalanceSection({ transactions, supplierName }: { transactions: PackagingTransaction[]; supplierName: string }) {
  const balance: PackagingBalance[] = PACKAGING_TYPES.map((pt) => {
    const sent = transactions
      .filter((t) => t.packaging_type === pt.value && t.transaction_type === "SENT")
      .reduce((acc, t) => acc + t.quantity, 0)
    const returned = transactions
      .filter((t) => t.packaging_type === pt.value && t.transaction_type === "RETURNED")
      .reduce((acc, t) => acc + t.quantity, 0)
    return { type: pt.value, label: pt.label, sent, returned, balance: sent - returned }
  })

  const history = [...transactions].sort((a, b) => b.date.localeCompare(a.date))

  function handleExport() {
    exportPackagingPDF(supplierName, transactions)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Export button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={transactions.length === 0}
          className="gap-1.5"
        >
          <FileDown className="size-3.5" />
          Export PDF
        </Button>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-3 gap-3">
        {balance.map((b) => (
          <div key={b.type} className="rounded-xl border bg-card p-4 flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{b.label}</p>
            <div className="grid grid-cols-3 gap-1 text-center mt-1">
              <div>
                <div className="text-base font-semibold tabular-nums">{b.sent}</div>
                <div className="text-xs text-muted-foreground">Sent</div>
              </div>
              <div>
                <div className="text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {b.returned}
                </div>
                <div className="text-xs text-muted-foreground">Returned</div>
              </div>
              <div>
                <div
                  className={`text-base font-semibold tabular-nums ${
                    b.balance > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {b.balance}
                </div>
                <div className="text-xs text-muted-foreground">Balance</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Transaction history */}
      {history.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">Transaction History</p>
          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Packaging</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((t) => {
                  const isSent = t.transaction_type === "SENT"
                  const ptLabel = PACKAGING_TYPES.find((p) => p.value === t.packaging_type)?.label ?? t.packaging_type
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">{formatDate(t.date)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            isSent
                              ? "text-blue-600 border-blue-200 dark:text-blue-400 dark:border-blue-900"
                              : "text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-900"
                          }`}
                        >
                          {isSent ? "Sent" : "Returned"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{ptLabel}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{t.quantity}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.note ?? "—"}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {history.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="size-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No packaging transactions yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Packaging is recorded when you create a new shipment.
          </p>
        </div>
      )}
    </div>
  )
}

// ---------- Supplier Detail ----------

interface DetailProps {
  supplier: Supplier
  onBack: () => void
}

function SupplierDetail({ supplier, onBack }: DetailProps) {
  const [shipments, setShipments] = React.useState<ShipmentRow[]>([])
  const [packaging, setPackaging] = React.useState<PackagingTransaction[]>([])
  const [loading, setLoading] = React.useState(true)
  const [shipmentDialogOpen, setShipmentDialogOpen] = React.useState(false)
  const [returnDialogOpen, setReturnDialogOpen] = React.useState(false)

  async function load() {
    setLoading(true)
    const [shipRes, pkgRes] = await Promise.all([
      supabase
        .from("shipments")
        .select("*, raw_materials(name, unit_of_measure)")
        .eq("supplier_id", supplier.id)
        .order("date", { ascending: false }),
      supabase
        .from("packaging_transactions")
        .select("*")
        .eq("supplier_id", supplier.id)
        .order("date", { ascending: false }),
    ])
    setShipments((shipRes.data as ShipmentRow[]) ?? [])
    setPackaging((pkgRes.data as PackagingTransaction[]) ?? [])
    setLoading(false)
  }

  React.useEffect(() => { load() }, [supplier.id])

  const totalSpend = shipments.reduce((acc, s) => acc + s.quantity * s.unit_price, 0)

  // Map shipment_id → SENT packaging for inline display in the shipment table
  const packagingByShipment = React.useMemo(() => {
    const map = new Map<string, PackagingTransaction[]>()
    for (const t of packaging) {
      if (t.transaction_type === "SENT" && t.shipment_id) {
        if (!map.has(t.shipment_id)) map.set(t.shipment_id, [])
        map.get(t.shipment_id)!.push(t)
      }
    }
    return map
  }, [packaging])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="-ml-1 mt-0.5 shrink-0">
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight">{supplier.name}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-1">
              {supplier.contact_person && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <User className="size-3.5" />
                  {supplier.contact_person}
                </span>
              )}
              {supplier.phone && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="size-3.5" />
                  {supplier.phone}
                </span>
              )}
              {supplier.email && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Mail className="size-3.5" />
                  {supplier.email}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setReturnDialogOpen(true)}>
            <RotateCcw className="size-3.5" />
            Return Packaging
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setShipmentDialogOpen(true)}>
            <Truck className="size-3.5" />
            New Shipment
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground mb-1">Total Spend</div>
          <div className="text-lg font-semibold tabular-nums">{formatCurrency(totalSpend)}</div>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground mb-1">Shipments</div>
          <div className="text-lg font-semibold">{shipments.length}</div>
        </div>
        {shipments.length > 0 && (
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-xs text-muted-foreground mb-1">Last Delivery</div>
            <div className="text-lg font-semibold">{formatDate(shipments[0].date)}</div>
          </div>
        )}
      </div>

      <Separator />

      {/* Tabs */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <Tabs defaultValue="history">
          <TabsList>
            <TabsTrigger value="history">
              Shipment History{" "}
              {shipments.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs">
                  {shipments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="packaging">Packaging</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-4">
            {shipments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Truck className="size-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No shipments yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Click "New Shipment" to record the first delivery.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Packaging</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipments.map((s) => {
                      const shipPkg = packagingByShipment.get(s.id) ?? []
                      const pkgParts = PACKAGING_TYPES
                        .map((pt) => {
                          const total = shipPkg
                            .filter((t) => t.packaging_type === pt.value)
                            .reduce((acc, t) => acc + t.quantity, 0)
                          return total > 0 ? `${total} ${pt.label.toLowerCase()}` : null
                        })
                        .filter(Boolean)
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="text-sm">{formatDate(s.date)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{s.raw_materials.name}</span>
                              <span className="text-xs text-muted-foreground">{s.raw_materials.unit_of_measure}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {s.quantity}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                            {s.unit_price > 0 ? formatCurrency(s.unit_price) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {s.unit_price > 0 ? formatCurrency(s.quantity * s.unit_price) : "—"}
                          </TableCell>
                          <TableCell>
                            {s.invoice_number ? (
                              <Badge variant="outline" className="text-xs font-mono">
                                {s.invoice_number}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {pkgParts.length > 0
                              ? pkgParts.join(" · ")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                            {s.note ?? "—"}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="packaging" className="mt-4">
            <PackagingBalanceSection transactions={packaging} supplierName={supplier.name} />
          </TabsContent>
        </Tabs>
      )}

      <NewShipmentDialog
        supplier={supplier}
        open={shipmentDialogOpen}
        onClose={() => setShipmentDialogOpen(false)}
        onDone={() => { setShipmentDialogOpen(false); load() }}
      />
      <ReturnPackagingDialog
        supplier={supplier}
        open={returnDialogOpen}
        onClose={() => setReturnDialogOpen(false)}
        onDone={() => { setReturnDialogOpen(false); load() }}
      />
    </div>
  )
}

// ---------- Page Root ----------

export function Suppliers() {
  const [selected, setSelected] = React.useState<Supplier | null>(null)
  const [listKey, setListKey] = React.useState(0)

  function handleBack() {
    setSelected(null)
    setListKey((k) => k + 1)
  }

  if (selected) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full">
        <SupplierDetail supplier={selected} onBack={handleBack} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground mt-1">
            Manage suppliers, track deliveries and packaging balances.{" "}
            <span className="text-xs">Click a supplier to view details.</span>
          </p>
        </div>
        <AddSupplierDialog onCreated={() => setListKey((k) => k + 1)} />
      </div>
      <SupplierList key={listKey} onSelect={setSelected} />
    </div>
  )
}
