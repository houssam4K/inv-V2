export type UnitOfMeasure = "units" | "kg" | "liters" | "meters" | "rolls"

export const UNITS: { value: UnitOfMeasure; label: string }[] = [
  { value: "units", label: "Units / Pieces" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "liters", label: "Liters (L)" },
  { value: "meters", label: "Meters (m)" },
  { value: "rolls", label: "Rolls" },
]

export interface RawMaterial {
  id: string
  name: string
  unit_of_measure: UnitOfMeasure
  current_quantity: number
  daily_consumption: number | null
  packaging_level1_label: string | null
  packaging_level1_size: number | null
  packaging_level2_label: string | null
  packaging_level2_size: number | null
  created_at: string
}

export interface StockMovement {
  id: string
  raw_material_id: string
  movement_type: "IN" | "OUT"
  quantity: number
  date: string
  note: string | null
  supplier_name: string | null
  invoice_number: string | null
  shipment_id: string | null
}

export interface ProductionLine {
  id: string
  name: string
  created_at: string
}

export interface Product {
  id: string
  name: string
  line_id: string
  created_at: string
}

export interface Team {
  id: string
  name: string
  line_id: string
  created_at: string
}

export interface ProductionEntry {
  id: string
  product_id: string
  team_id: string
  date: string
  quantity: number
  created_at: string
}

export interface Supplier {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  nif: string | null
  rc: string | null
  art_number: string | null
  address: string | null
  created_at: string
}

export interface Shipment {
  id: string
  supplier_id: string
  raw_material_id: string
  quantity: number
  unit_price: number
  invoice_number: string | null
  date: string
  note: string | null
  created_at: string
}

export type PackagingType = "box" | "pallet" | "mandrin"

export const PACKAGING_TYPES: { value: PackagingType; label: string }[] = [
  { value: "box", label: "Box" },
  { value: "pallet", label: "Pallet" },
  { value: "mandrin", label: "Mandrin" },
]

export interface PackagingTransaction {
  id: string
  supplier_id: string
  transaction_type: "SENT" | "RETURNED" | "ADJUSTMENT"
  packaging_type: PackagingType
  quantity: number
  date: string
  shipment_id: string | null
  note: string | null
  bon_number: string | null
  batch_id: string | null
  created_at: string
}

export interface InventorySession {
  id: string
  date: string
  note: string | null
  created_at: string
}

export interface InventoryEntry {
  id: string
  session_id: string
  raw_material_id: string
  theoretical_quantity: number
  real_quantity: number
  created_at: string
}

export interface Note {
  id: string
  content: string
  author: string | null
  color: string
  created_at: string
}

export interface ExpectedShipment {
  id: string
  supplier_name: string
  description: string
  expected_date: string
  status: "pending" | "arrived"
  created_at: string
}

export interface BOMItem {
  id: string
  product_id: string
  raw_material_id: string
  unit_type: 'per_bottle' | 'per_fardeau' | 'per_pallet' | 'unknown'
  quantity_per_unit: number | null
  raw_materials?: { name: string; unit_of_measure: string }
  products?: { name: string }
}

export type SupplierDocumentType = "BC" | "BR"

export interface SupplierDocumentItem {
  id: string
  document_id: string
  position: number
  code: string | null
  designation: string
  quantity: number
  unit: string | null
  unit_price: number | null
}

export interface SupplierDocument {
  id: string
  doc_type: SupplierDocumentType
  number: string
  supplier_id: string
  date: string
  v_commande: string | null
  n_commande: string | null
  mode_paiement: string | null
  delai_livraison: string | null
  lieu_livraison: string | null
  tva_rate: number | null
  observations: string | null
  created_at: string
}
