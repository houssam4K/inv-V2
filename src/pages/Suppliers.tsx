import * as React from "react"
import {
  ArrowLeft,
  Building2,
  FileDown,
  Mail,
  MoreHorizontal,
  Package,
  Pencil,
  Phone,
  RotateCcw,
  Trash2,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { AddSupplierDialog } from "@/components/AddSupplierDialog"
import { EditSupplierDialog } from "@/components/EditSupplierDialog"
import { EditShipmentDialog, type ShipmentEditRow } from "@/components/EditShipmentDialog"
import { EditPackagingDialog } from "@/components/EditPackagingDialog"
import { NewShipmentDialog } from "@/components/NewShipmentDialog"
import { ReturnPackagingDialog } from "@/components/ReturnPackagingDialog"
import { SetPackagingCountDialog } from "@/components/SetPackagingCountDialog"
import { GeneratePurchaseOrderDialog } from "@/components/GeneratePurchaseOrderDialog"
import { GenerateReturnNoteDialog } from "@/components/GenerateReturnNoteDialog"
import { supabase } from "@/lib/supabase"
import {
  PACKAGING_TYPES,
  type PackagingType,
  type PackagingTransaction,
  type Supplier,
  type SupplierDocument,
  type SupplierDocumentItem
} from "@/lib/types"
import { exportPackagingPDF, exportPurchaseOrderPDF, exportReturnNotePDF } from "@/lib/pdf"

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
  onEdit: (supplier: Supplier) => void
  onDelete: (supplier: Supplier) => void
}

function SupplierList({ onSelect, onEdit, onDelete }: ListProps) {
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
        <div
          key={s.id}
          className="rounded-xl border bg-card px-5 py-4 hover:bg-accent/50 transition-colors group cursor-pointer"
          onClick={() => onSelect(s)}
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="size-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(s) }}>
                    <Pencil className="size-3.5 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => { e.stopPropagation(); onDelete(s) }}
                  >
                    <Trash2 className="size-3.5 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
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

function PackagingBalanceSection({
  transactions,
  filteredTransactions,
  supplier,
  onEdit,
  onDelete,
  onSetCount,
}: {
  transactions: PackagingTransaction[]
  filteredTransactions: PackagingTransaction[]
  supplier: Supplier
  onEdit: (t: PackagingTransaction) => void
  onDelete: (t: PackagingTransaction) => void
  onSetCount: (pt: PackagingType, bal: number) => void
}) {
  // Balance always uses all-time data
  const balance: PackagingBalance[] = PACKAGING_TYPES.map((pt) => {
    const sent = transactions
      .filter((t) => t.packaging_type === pt.value && t.transaction_type === "SENT")
      .reduce((acc, t) => acc + t.quantity, 0)
    const returned = transactions
      .filter((t) => t.packaging_type === pt.value && t.transaction_type === "RETURNED")
      .reduce((acc, t) => acc + t.quantity, 0)
    const adjustments = transactions
      .filter((t) => t.packaging_type === pt.value && t.transaction_type === "ADJUSTMENT")
      .reduce((acc, t) => acc + t.quantity, 0)
    return { type: pt.value, label: pt.label, sent, returned, balance: sent - returned + adjustments }
  })

  // History uses filtered data (by month), sorted newest first, each row = one transaction
  const sortedHistory = React.useMemo(() => {
    return [...filteredTransactions].sort((a, b) => b.date.localeCompare(a.date))
  }, [filteredTransactions])

  function handleExport() {
    exportPackagingPDF(supplier, transactions)
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
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{b.label}</p>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground" onClick={() => onSetCount(b.type as PackagingType, b.balance)}>
                Set count
              </Button>
            </div>
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
      {sortedHistory.length > 0 && (
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
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedHistory.map((t) => {
                  const isSent = t.transaction_type === "SENT"
                  const isAdj = t.transaction_type === "ADJUSTMENT"
                  const pkgLabel = PACKAGING_TYPES.find((pt) => pt.value === t.packaging_type)?.label ?? t.packaging_type
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">{formatDate(t.date)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            isSent
                              ? "text-blue-600 border-blue-200 dark:text-blue-400 dark:border-blue-900"
                              : isAdj
                              ? "text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-900"
                              : "text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-900"
                          }`}
                        >
                          {isSent ? "Sent" : isAdj ? "Adjustment" : "Returned"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{pkgLabel}</TableCell>
                      <TableCell className={`text-right tabular-nums font-medium ${isAdj ? (t.quantity > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive") : ""}`}>
                        {isAdj && t.quantity > 0 ? `+${t.quantity}` : t.quantity}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.note ?? "—"}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="size-7 p-0">
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(t)}>
                              <Pencil className="size-3.5 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => onDelete(t)}
                            >
                              <Trash2 className="size-3.5 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {sortedHistory.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="size-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            {sortedHistory.length === 0 && transactions.length > 0
              ? "No transactions in this month"
              : "No packaging transactions yet"}
          </p>
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

function fmtMonth(mk: string) {
  const [y, m] = mk.split("-").map(Number)
  return new Date(y, m - 1).toLocaleDateString("fr-DZ", { year: "numeric", month: "long" })
}

function SupplierDetail({ supplier, onBack }: DetailProps) {
  const [shipments, setShipments] = React.useState<ShipmentRow[]>([])
  const [packaging, setPackaging] = React.useState<PackagingTransaction[]>([])
  const [loading, setLoading] = React.useState(true)
  const [shipmentDialogOpen, setShipmentDialogOpen] = React.useState(false)
  const [returnDialogOpen, setReturnDialogOpen] = React.useState(false)
  const [editShipment, setEditShipment] = React.useState<ShipmentEditRow | null>(null)
  const [deleteShipmentTarget, setDeleteShipmentTarget] = React.useState<ShipmentRow | null>(null)
  const [deletingShipment, setDeletingShipment] = React.useState(false)
  const [editPackaging, setEditPackaging] = React.useState<PackagingTransaction | null>(null)
  const [deletePackagingTarget, setDeletePackagingTarget] = React.useState<PackagingTransaction | null>(null)
  const [deletingPackaging, setDeletingPackaging] = React.useState(false)
  const [bcDialogOpen, setBcDialogOpen] = React.useState(false)
  const [brDialogOpen, setBrDialogOpen] = React.useState(false)
  const [documents, setDocuments] = React.useState<(SupplierDocument & { items: SupplierDocumentItem[] })[]>([])
  const [deleteDocTarget, setDeleteDocTarget] = React.useState<string | null>(null)
  const [countDialogOpen, setCountDialogOpen] = React.useState(false)
  const [countPkgType, setCountPkgType] = React.useState<PackagingType | null>(null)
  const [countBalance, setCountBalance] = React.useState(0)
  const [selectedMonth, setSelectedMonth] = React.useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })

  async function load() {
    setLoading(true)
    const [shipRes, pkgRes, docRes] = await Promise.all([
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
      supabase
        .from("supplier_documents")
        .select("*, items:supplier_document_items(*)")
        .eq("supplier_id", supplier.id)
        .order("created_at", { ascending: false }),
    ])
    setShipments((shipRes.data as ShipmentRow[]) ?? [])
    setPackaging((pkgRes.data as PackagingTransaction[]) ?? [])
    setDocuments((docRes.data as any) ?? [])
    setLoading(false)
  }

  React.useEffect(() => { load() }, [supplier.id])

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

  const filteredShipments = React.useMemo(
    () => shipments.filter((s) => s.date.slice(0, 7) === selectedMonth),
    [shipments, selectedMonth]
  )

  const totalSpend = filteredShipments.reduce((acc, s) => acc + s.quantity * s.unit_price, 0)

  const filteredPackaging = React.useMemo(
    () => packaging.filter((t) => t.date.slice(0, 7) === selectedMonth),
    [packaging, selectedMonth]
  )

  function prevMonth() {
    const [y, m] = selectedMonth.split("-").map(Number)
    const pm = m === 1 ? 12 : m - 1
    const py = m === 1 ? y - 1 : y
    setSelectedMonth(`${py}-${String(pm).padStart(2, "0")}`)
  }

  function nextMonth() {
    const [y, m] = selectedMonth.split("-").map(Number)
    const nm = m === 12 ? 1 : m + 1
    const ny = m === 12 ? y + 1 : y
    setSelectedMonth(`${ny}-${String(nm).padStart(2, "0")}`)
  }

  async function handleDeleteShipment() {
    if (!deleteShipmentTarget) return
    setDeletingShipment(true)

    // Delete ALL associated stock movements (not just one)
    await supabase
      .from("stock_movements")
      .delete()
      .eq("shipment_id", deleteShipmentTarget.id)

    // Explicitly delete any packaging transactions tied to this shipment
    // to prevent them from becoming orphaned in the database.
    await supabase
      .from("packaging_transactions")
      .delete()
      .eq("shipment_id", deleteShipmentTarget.id)

    // Delete the shipment itself
    await supabase.from("shipments").delete().eq("id", deleteShipmentTarget.id)

    setDeletingShipment(false)
    setDeleteShipmentTarget(null)
    await load()
  }

  async function handleDeletePackaging() {
    if (!deletePackagingTarget) return
    setDeletingPackaging(true)

    await supabase.from("packaging_transactions").delete().eq("id", deletePackagingTarget.id)

    setDeletingPackaging(false)
    setDeletePackagingTarget(null)
    await load()
  }

  async function handleDeleteDocument(id: string) {
    await supabase.from("supplier_documents").delete().eq("id", id)
    setDeleteDocTarget(null)
    await load()
  }

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
        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <FileDown className="size-3.5" />
                Générer Document
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setBcDialogOpen(true)}>
                Bon de Commande (BC)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBrDialogOpen(true)}>
                Bon de Retour (BR)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

      {/* Month navigator */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-medium">Viewing</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth}>&larr;</Button>
          <span className="text-sm font-medium min-w-[160px] text-center">
            {fmtMonth(selectedMonth)}
          </span>
          <Button variant="outline" size="sm" onClick={nextMonth}>&rarr;</Button>
        </div>
      </div>

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
              {filteredShipments.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs">
                  {filteredShipments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="packaging">Packaging</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-4">
            {filteredShipments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Truck className="size-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  {shipments.length > 0 ? "No shipments in this month" : "No shipments yet"}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {shipments.length === 0 && 'Click "New Shipment" to record the first delivery.'}
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
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredShipments.map((s) => {
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
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="size-7 p-0">
                                  <MoreHorizontal className="size-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEditShipment(s as ShipmentEditRow)}>
                                  <Pencil className="size-3.5 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteShipmentTarget(s)}
                                >
                                  <Trash2 className="size-3.5 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
            <PackagingBalanceSection
              transactions={packaging}
              filteredTransactions={filteredPackaging}
              supplier={supplier}
              onEdit={setEditPackaging}
              onDelete={setDeletePackagingTarget}
              onSetCount={(type, balance) => {
                setCountPkgType(type)
                setCountBalance(balance)
                setCountDialogOpen(true)
              }}
            />
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileDown className="size-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Aucun document généré</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Générez un Bon de Commande ou de Retour depuis le menu en haut.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Numéro</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Lignes</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <Badge variant="outline" className={doc.doc_type === "BC" ? "text-blue-600 border-blue-200" : "text-purple-600 border-purple-200"}>
                            {doc.doc_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{doc.number}</TableCell>
                        <TableCell>{formatDate(doc.date)}</TableCell>
                        <TableCell className="text-right tabular-nums">{doc.items?.length || 0}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (doc.doc_type === "BC") {
                                  exportPurchaseOrderPDF(supplier, doc, doc.items)
                                } else {
                                  exportReturnNotePDF(supplier, doc, doc.items)
                                }
                              }}
                            >
                              Télécharger PDF
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteDocTarget(doc.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
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
      <GeneratePurchaseOrderDialog
        supplier={supplier}
        open={bcDialogOpen}
        onClose={() => setBcDialogOpen(false)}
        onDone={() => { setBcDialogOpen(false); load() }}
      />
      <GenerateReturnNoteDialog
        supplier={supplier}
        open={brDialogOpen}
        onClose={() => setBrDialogOpen(false)}
        onDone={() => { setBrDialogOpen(false); load() }}
      />
      <EditShipmentDialog
        shipment={editShipment}
        open={!!editShipment}
        onClose={() => setEditShipment(null)}
        onSaved={() => { setEditShipment(null); load() }}
      />
      <AlertDialog
        open={!!deleteShipmentTarget}
        onOpenChange={(v) => { if (!v) setDeleteShipmentTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this shipment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the shipment of{" "}
              <strong>{deleteShipmentTarget?.quantity} {deleteShipmentTarget?.raw_materials?.unit_of_measure}</strong>{" "}
              of <strong>{deleteShipmentTarget?.raw_materials?.name}</strong> and reverse the stock movement.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteShipment}
              disabled={deletingShipment}
            >
              {deletingShipment ? "Deleting..." : "Delete Shipment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SetPackagingCountDialog
        supplier={supplier}
        packagingType={countPkgType}
        currentBalance={countBalance}
        open={countDialogOpen}
        onClose={() => setCountDialogOpen(false)}
        onDone={() => { setCountDialogOpen(false); load() }}
      />

      <EditPackagingDialog
        transaction={editPackaging}
        open={!!editPackaging}
        onClose={() => setEditPackaging(null)}
        onSaved={() => { setEditPackaging(null); load() }}
      />

      <AlertDialog
        open={!!deletePackagingTarget}
        onOpenChange={(v) => { if (!v) setDeletePackagingTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this packaging record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the packaging record of{" "}
              <strong>{deletePackagingTarget?.quantity} {deletePackagingTarget?.packaging_type}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeletePackaging}
              disabled={deletingPackaging}
            >
              {deletingPackaging ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteDocTarget}
        onOpenChange={(v) => { if (!v) setDeleteDocTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>
              Ce document sera définitivement supprimé. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteDocTarget && handleDeleteDocument(deleteDocTarget)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------- Page Root ----------

export function Suppliers() {
  const [selected, setSelected] = React.useState<Supplier | null>(null)
  const [listKey, setListKey] = React.useState(0)
  const [editSupplier, setEditSupplier] = React.useState<Supplier | null>(null)
  const [deleteSupplierTarget, setDeleteSupplierTarget] = React.useState<Supplier | null>(null)
  const [deletingSupplier, setDeletingSupplier] = React.useState(false)

  function refreshList() { setListKey((k) => k + 1) }

  function handleBack() {
    setSelected(null)
    refreshList()
  }

  async function handleDeleteSupplier() {
    if (!deleteSupplierTarget) return
    setDeletingSupplier(true)

    // Delete all stock movements linked to this supplier's shipments.
    // We delete directly by shipment_id and loop to avoid row-limit issues on intermediate SELECTs.
    let allShipIds: string[] = []
    let hasMore = true
    let page = 0
    while (hasMore) {
      const { data: shipRows } = await supabase
        .from("shipments")
        .select("id")
        .eq("supplier_id", deleteSupplierTarget.id)
        .range(page * 1000, (page + 1) * 1000 - 1)

      if (shipRows && shipRows.length > 0) {
        allShipIds.push(...shipRows.map(s => s.id))
        page++
      } else {
        hasMore = false
      }
    }

    if (allShipIds.length > 0) {
      for (let i = 0; i < allShipIds.length; i += 100) {
        const chunk = allShipIds.slice(i, i + 100)
        await supabase.from("stock_movements").delete().in("shipment_id", chunk)
      }
    }

    // Delete supplier (cascades to shipments and packaging_transactions)
    await supabase.from("suppliers").delete().eq("id", deleteSupplierTarget.id)

    setDeletingSupplier(false)
    setDeleteSupplierTarget(null)
    refreshList()
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
        <AddSupplierDialog onCreated={refreshList} />
      </div>
      <SupplierList
        key={listKey}
        onSelect={setSelected}
        onEdit={setEditSupplier}
        onDelete={setDeleteSupplierTarget}
      />

      <EditSupplierDialog
        supplier={editSupplier}
        open={!!editSupplier}
        onClose={() => setEditSupplier(null)}
        onSaved={() => { setEditSupplier(null); refreshList() }}
      />

      <AlertDialog
        open={!!deleteSupplierTarget}
        onOpenChange={(v) => { if (!v) setDeleteSupplierTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteSupplierTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the supplier along with all their shipments and
              packaging records. Stock quantities will be adjusted to remove deliveries from
              this supplier. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteSupplier}
              disabled={deletingSupplier}
            >
              {deletingSupplier ? "Deleting..." : "Delete Supplier"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
