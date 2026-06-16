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
