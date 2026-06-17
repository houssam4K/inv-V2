
CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  raw_material_id uuid NOT NULL REFERENCES raw_materials(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  invoice_number text,
  date date NOT NULL DEFAULT current_date,
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE packaging_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('SENT', 'RETURNED')),
  packaging_type text NOT NULL CHECK (packaging_type IN ('box', 'pallet', 'mandrin')),
  quantity integer NOT NULL CHECK (quantity > 0),
  date date NOT NULL DEFAULT current_date,
  shipment_id uuid REFERENCES shipments(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE packaging_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_suppliers" ON suppliers FOR SELECT TO anon USING (true);
CREATE POLICY "insert_suppliers" ON suppliers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update_suppliers" ON suppliers FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "delete_suppliers" ON suppliers FOR DELETE TO anon USING (true);

CREATE POLICY "select_shipments" ON shipments FOR SELECT TO anon USING (true);
CREATE POLICY "insert_shipments" ON shipments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update_shipments" ON shipments FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "delete_shipments" ON shipments FOR DELETE TO anon USING (true);

CREATE POLICY "select_packaging_transactions" ON packaging_transactions FOR SELECT TO anon USING (true);
CREATE POLICY "insert_packaging_transactions" ON packaging_transactions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update_packaging_transactions" ON packaging_transactions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "delete_packaging_transactions" ON packaging_transactions FOR DELETE TO anon USING (true);
