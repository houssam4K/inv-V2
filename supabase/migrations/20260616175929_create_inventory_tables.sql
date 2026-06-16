
CREATE TABLE raw_materials (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  unit_of_measure text NOT NULL,
  current_quantity numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE raw_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_raw_materials" ON raw_materials FOR SELECT TO anon USING (true);
CREATE POLICY "insert_raw_materials" ON raw_materials FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update_raw_materials" ON raw_materials FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "delete_raw_materials" ON raw_materials FOR DELETE TO anon USING (true);

CREATE TABLE stock_movements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  raw_material_id uuid NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('IN', 'OUT')),
  quantity numeric NOT NULL CHECK (quantity > 0),
  date timestamptz DEFAULT now(),
  note text
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_stock_movements" ON stock_movements FOR SELECT TO anon USING (true);
CREATE POLICY "insert_stock_movements" ON stock_movements FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update_stock_movements" ON stock_movements FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "delete_stock_movements" ON stock_movements FOR DELETE TO anon USING (true);
