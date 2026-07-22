import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { PACKAGING_TYPES, type PackagingTransaction, type Supplier, type SupplierDocument, type SupplierDocumentItem } from "./types"
import { COMPANY_INFO } from "./company"

const BRAND = "RawTrack"
const ACCENT = [32, 32, 32] as [number, number, number]  // near-black primary
const MUTED = [100, 100, 100] as [number, number, number]
const LOSS_COLOR = [180, 100, 20] as [number, number, number]
const OK_COLOR = [30, 130, 80] as [number, number, number]
const SURPLUS_COLOR = [30, 80, 180] as [number, number, number]

function fmt(n: number) {
  return n.toLocaleString() + " DA"
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-DZ", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function addHeader(doc: jsPDF, title: string, subtitle: string) {
  const pageW = doc.internal.pageSize.getWidth()

  // Brand
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.text(BRAND, 14, 12)

  // Generated date (right-aligned)
  const genLabel = `Generated: ${new Date().toLocaleDateString("fr-DZ", { day: "2-digit", month: "short", year: "numeric" })}`
  doc.text(genLabel, pageW - 14, 12, { align: "right" })

  // Separator line
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(14, 15, pageW - 14, 15)

  // Title
  doc.setFontSize(18)
  doc.setTextColor(...ACCENT)
  doc.setFont("helvetica", "bold")
  doc.text(title, 14, 26)

  // Subtitle
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.setFont("helvetica", "normal")
  doc.text(subtitle, 14, 33)

  return 40  // return Y cursor after header
}

function addPageNumbers(doc: jsPDF) {
  const total = (doc.internal as unknown as { getNumberOfPages(): number }).getNumberOfPages()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(`Page ${i} / ${total}`, pageW - 14, pageH - 8, { align: "right" })
    doc.setTextColor(...MUTED)
    doc.text(BRAND, 14, pageH - 8)
  }
}

export function drawDocumentHeader(doc: jsPDF, opts: { title: string, supplier: Supplier, documentNumber: string, date: string, subtitle?: string }) {
  const pageW = doc.internal.pageSize.getWidth()

  // Logo
  try {
    // Attempt to add logo, ignore if path is invalid or missing in this env
    doc.addImage(COMPANY_INFO.logoPath, "PNG", 14, 10, 30, 30)
  } catch (e) {
    // Fallback if logo fails
    doc.setFontSize(16)
    doc.setTextColor(...ACCENT)
    doc.text(COMPANY_INFO.name.split(" ")[0], 14, 20)
  }

  // Document Title
  doc.setFontSize(16)
  doc.setTextColor(...ACCENT)
  doc.setFont("helvetica", "bold")
  const titleText = `${opts.title} N° ${opts.documentNumber}`
  doc.text(titleText, pageW - 14, 16, { align: "right" })

  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.setFont("helvetica", "normal")
  doc.text(`Date : ${opts.date}`, pageW - 14, 22, { align: "right" })
  if (opts.subtitle) {
    doc.text(opts.subtitle, pageW - 14, 28, { align: "right" })
  }

  // Separator line
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(14, 45, pageW - 14, 45)

  // Supplier block
  doc.setFontSize(10)
  doc.setTextColor(...ACCENT)
  doc.setFont("helvetica", "bold")
  doc.text("FOURNISSEUR", 14, 52)

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(40, 40, 40)
  doc.text(opts.supplier.name, 14, 58)
  doc.text(`Adresse : ${opts.supplier.address || "—"}`, 14, 63)
  doc.text(`RC : ${opts.supplier.rc || "—"}`, 14, 68)
  doc.text(`N° ART : ${opts.supplier.art_number || "—"}`, 60, 68)
  doc.text(`NIF : ${opts.supplier.nif || "—"}`, 110, 68)

  return 76 // return Y cursor after header
}

export function drawDocumentFooter(doc: jsPDF) {
  const total = (doc.internal as unknown as { getNumberOfPages(): number }).getNumberOfPages()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  for (let i = 1; i <= total; i++) {
    doc.setPage(i)

    // Separator line
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.3)
    doc.line(14, pageH - 20, pageW - 14, pageH - 20)

    // Company info
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.setFont("helvetica", "normal")
    
    const info1 = `${COMPANY_INFO.name} — ${COMPANY_INFO.addressLine}`
    const info2 = `Tél: ${COMPANY_INFO.phone} — Email: ${COMPANY_INFO.email}`
    const info3 = `RC: ${COMPANY_INFO.rc} — N° ART: ${COMPANY_INFO.artNumber} — NIF: ${COMPANY_INFO.nif}`

    doc.text(info1, pageW / 2, pageH - 16, { align: "center" })
    doc.text(info2, pageW / 2, pageH - 12, { align: "center" })
    doc.text(info3, pageW / 2, pageH - 8, { align: "center" })

    // Page number
    doc.text(`Page ${i} / ${total}`, pageW - 14, pageH - 12, { align: "right" })
  }
}

// ---------- Finance PDF ----------

interface FinancePdfRow {
  date: string
  quantity: number
  unit_price: number
  invoice_number: string | null
  suppliers: { name: string }
  raw_materials: { name: string; unit_of_measure: string }
}

interface SupplierBreakdown {
  name: string
  total: number
  count: number
}

export function exportFinancePDF(
  rows: FinancePdfRow[],
  month: string,
  bySupplier: SupplierBreakdown[]
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
  const [y, m] = month.split("-").map(Number)
  const monthLabel = new Date(y, m - 1).toLocaleDateString("fr-DZ", { year: "numeric", month: "long" })

  let cursor = addHeader(doc, "Purchases Report", monthLabel)

  const totalSpend = rows.reduce((acc, r) => acc + r.quantity * r.unit_price, 0)

  // Summary box
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(`Total spend:`, 14, cursor + 5)
  doc.setFontSize(12)
  doc.setTextColor(...ACCENT)
  doc.setFont("helvetica", "bold")
  doc.text(fmt(totalSpend), 40, cursor + 5)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(`Shipments: ${rows.length}`, 14, cursor + 11)

  cursor += 18

  // Per-supplier breakdown (small chips)
  if (bySupplier.length > 0) {
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text("By Supplier:", 14, cursor)
    let xOff = 14
    cursor += 4
    bySupplier.forEach((s) => {
      const label = `${s.name}: ${fmt(s.total)} (${s.count})`
      doc.setFontSize(8)
      doc.setTextColor(60, 60, 60)
      doc.text(label, xOff, cursor)
      xOff += doc.getStringUnitWidth(label) * 8 * 0.352 + 8
      if (xOff > 240) { xOff = 14; cursor += 5 }
    })
    cursor += 6
  }

  // Main purchases table
  autoTable(doc, {
    startY: cursor,
    head: [["Date", "Supplier", "Material", "Unit", "Qty", "Unit Price", "Total", "Invoice"]],
    body: rows.map((r) => [
      fmtDate(r.date),
      r.suppliers.name,
      r.raw_materials.name,
      r.raw_materials.unit_of_measure,
      r.quantity,
      r.unit_price > 0 ? fmt(r.unit_price) : "—",
      r.unit_price > 0 ? fmt(r.quantity * r.unit_price) : "—",
      r.invoice_number ?? "—",
    ]),
    foot: [["", "", "", "", "", "TOTAL", fmt(totalSpend), ""]],
    headStyles: { fillColor: [32, 32, 32], fontSize: 8, fontStyle: "bold" },
    footStyles: { fillColor: [240, 240, 240], textColor: [32, 32, 32], fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 38 },
      2: { cellWidth: 45 },
      3: { cellWidth: 18 },
      4: { cellWidth: 18, halign: "right" },
      5: { cellWidth: 28, halign: "right" },
      6: { cellWidth: 28, halign: "right", fontStyle: "bold" },
      7: { cellWidth: 28 },
    },
    margin: { left: 14, right: 14 },
  })

  addPageNumbers(doc)
  doc.save(`purchases-${month}.pdf`)
}

// ---------- Packaging PDF ----------

export function exportPackagingPDF(
  supplier: Supplier,
  transactions: PackagingTransaction[]
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

  const dateStr = new Date().toLocaleDateString("fr-DZ", { year: "numeric", month: "long", day: "numeric" })
  let cursor = drawDocumentHeader(doc, {
    title: "SITUATION EMBALLAGE",
    supplier,
    documentNumber: "",
    date: dateStr,
  })

  // Balance per type
  const balance = PACKAGING_TYPES.map((pt) => {
    const sent = transactions
      .filter((t) => t.packaging_type === pt.value && t.transaction_type === "SENT")
      .reduce((a, t) => a + t.quantity, 0)
    const returned = transactions
      .filter((t) => t.packaging_type === pt.value && t.transaction_type === "RETURNED")
      .reduce((a, t) => a + t.quantity, 0)
    const adjustments = transactions
      .filter((t) => t.packaging_type === pt.value && t.transaction_type === "ADJUSTMENT")
      .reduce((a, t) => a + t.quantity, 0)
    return { label: pt.label, sent, returned, balance: sent - returned + adjustments }
  })

  cursor += 4

  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...ACCENT)
  doc.text("Solde Emballage", 14, cursor)
  cursor += 4

  autoTable(doc, {
    startY: cursor,
    head: [["Type d'emballage", "Envoyé", "Retourné", "Solde (restant)"]],
    body: balance.map((b) => [b.label, b.sent, b.returned, b.balance]),
    headStyles: { fillColor: [32, 32, 32], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3) {
        const val = Number(data.cell.raw)
        if (val > 0) data.cell.styles.textColor = LOSS_COLOR
        else if (val < 0) data.cell.styles.textColor = SURPLUS_COLOR
        else data.cell.styles.textColor = OK_COLOR
      }
    },
    margin: { left: 14, right: 14 },
  })

  const afterBalance = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  cursor = afterBalance + 10

  // Transaction history (grouped)
  if (transactions.length > 0) {
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...ACCENT)
    doc.text("Historique des Mouvements", 14, cursor)
    cursor += 4

    // Grouping
    const groups: Record<string, { date: string; bon_number: string | null; type: "SENT" | "RETURNED" | "ADJUSTMENT"; qtys: Record<string, number> }> = {}
    
    transactions.forEach(t => {
      const key = t.batch_id || `${t.date}-${t.transaction_type}`
      if (!groups[key]) {
        groups[key] = {
          date: t.date,
          bon_number: t.bon_number,
          type: t.transaction_type,
          qtys: {}
        }
      }
      groups[key].qtys[t.packaging_type] = (groups[key].qtys[t.packaging_type] || 0) + t.quantity
    })

    const sortedGroups = Object.values(groups).sort((a, b) => b.date.localeCompare(a.date))

    const packagingHeaders = PACKAGING_TYPES.map(pt => pt.label)
    
    autoTable(doc, {
      startY: cursor,
      head: [["Date", "N° Bon", "Mouvement", ...packagingHeaders]],
      body: sortedGroups.map((g) => [
        fmtDate(g.date),
        g.bon_number || "—",
        g.type === "SENT" ? "Envoi" : g.type === "RETURNED" ? "Retour" : "Ajustement",
        ...PACKAGING_TYPES.map(pt => {
          if (!g.qtys[pt.value]) return ""
          return (g.type === "ADJUSTMENT" && g.qtys[pt.value] > 0) ? `+${g.qtys[pt.value]}` : String(g.qtys[pt.value])
        })
      ]),
      headStyles: { fillColor: [32, 32, 32], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          const val = data.cell.raw as string
          data.cell.styles.textColor = val === "Envoi" ? [40, 80, 160] : val === "Retour" ? [30, 130, 80] : [180, 120, 20]
          data.cell.styles.fontStyle = "bold"
        }
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 28 },
        2: { cellWidth: 22 },
        // Remaining columns dynamic, right-aligned
        ...Object.fromEntries(PACKAGING_TYPES.map((_, i) => [i + 3, { halign: "right" }]))
      },
      margin: { left: 14, right: 14 },
    })
  }

  drawDocumentFooter(doc)

  const filename = `emballage-${supplier.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}

// ---------- Purchase Order (BC) PDF ----------

export function exportPurchaseOrderPDF(
  supplier: Supplier,
  document: SupplierDocument,
  items: SupplierDocumentItem[]
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()

  let cursor = drawDocumentHeader(doc, {
    title: "BON DE COMMANDE",
    supplier,
    documentNumber: document.number,
    date: fmtDate(document.date),
  })

  // Items table
  autoTable(doc, {
    startY: cursor,
    head: [["Désignation", "Quantité", "Unité", "Prix Unitaire HT", "Montant Total HT"]],
    body: items.map(it => [
      it.designation,
      it.quantity,
      it.unit || "—",
      it.unit_price ? fmt(it.unit_price) : "—",
      it.unit_price ? fmt(it.quantity * it.unit_price) : "—"
    ]),
    headStyles: { fillColor: [32, 32, 32], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: "auto" as unknown as number },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 35, halign: "right" },
      4: { cellWidth: 35, halign: "right", fontStyle: "bold" }
    },
    margin: { left: 14, right: 14 },
  })

  let afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  
  // Totals
  const totalHT = items.reduce((acc, it) => acc + (it.quantity * (it.unit_price || 0)), 0)
  const tvaAmount = totalHT * ((document.tva_rate || 19) / 100)
  const totalTTC = totalHT + tvaAmount

  autoTable(doc, {
    startY: afterTable + 5,
    body: [
      ["TOTAL HT", fmt(totalHT)],
      [`TVA (${document.tva_rate || 19}%)`, fmt(tvaAmount)],
      ["TOTAL TTC", fmt(totalTTC)]
    ],
    theme: "plain",
    bodyStyles: { fontSize: 10, halign: "right" },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: pageW - 70 },
      1: { fontStyle: "bold", cellWidth: 42, textColor: ACCENT }
    },
    margin: { left: 14, right: 14 }
  })

  cursor = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  // Conditions
  doc.setFontSize(9)
  doc.setTextColor(40, 40, 40)
  doc.setFont("helvetica", "normal")
  doc.text(`Mode de paiement : ${document.mode_paiement || "—"}`, 14, cursor)
  doc.text(`Délai de livraison : ${document.delai_livraison || "—"}`, 14, cursor + 5)
  doc.text(`Lieu de livraison : ${document.lieu_livraison || "—"}`, 14, cursor + 10)
  if (document.observations) {
    doc.text(`Observations : ${document.observations}`, 14, cursor + 15)
  }

  // Signatures
  cursor += 30
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("Le Fournisseur (Cachet et signature)", 14, cursor)
  doc.text("SARL IFREN (Cachet et signature)", pageW - 14, cursor, { align: "right" })

  drawDocumentFooter(doc)

  const filename = `BC-${document.number.replace(/\//g, "-")}-${supplier.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.pdf`
  doc.save(filename)
}

// ---------- Return Note (BR) PDF ----------

export function exportReturnNotePDF(
  supplier: Supplier,
  document: SupplierDocument,
  items: SupplierDocumentItem[]
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()

  let cursor = drawDocumentHeader(doc, {
    title: "BON DE RETOUR",
    supplier,
    documentNumber: document.number,
    date: fmtDate(document.date),
  })

  // Reference Commands
  if (document.v_commande || document.n_commande) {
    doc.setFontSize(9)
    doc.setTextColor(40, 40, 40)
    doc.setFont("helvetica", "normal")
    let txt = []
    if (document.v_commande) txt.push(`V/Commande : ${document.v_commande}`)
    if (document.n_commande) txt.push(`N/Commande : ${document.n_commande}`)
    doc.text(txt.join("   |   "), 14, cursor)
    cursor += 8
  }

  // Items table
  autoTable(doc, {
    startY: cursor,
    head: [["Code", "Désignation Emballage", "Quantité"]],
    body: items.map(it => [
      it.code || "—",
      it.designation,
      it.quantity
    ]),
    headStyles: { fillColor: [32, 32, 32], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: "auto" as unknown as number },
      2: { cellWidth: 30, halign: "center", fontStyle: "bold" }
    },
    margin: { left: 14, right: 14 },
  })

  let afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  
  // Signatures
  cursor = afterTable + 30
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("Visa du Client", 30, cursor)
  doc.text("Visa du Fournisseur", pageW - 30, cursor, { align: "right" })

  drawDocumentFooter(doc)

  const filename = `BR-${document.number.replace(/\//g, "-")}-${supplier.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.pdf`
  doc.save(filename)
}

