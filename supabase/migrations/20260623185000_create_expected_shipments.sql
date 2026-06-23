CREATE TABLE expected_shipments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_name text NOT NULL,
  description text NOT NULL,
  expected_date date NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'arrived')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE expected_shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_expected_shipments" ON expected_shipments FOR SELECT TO anon USING (true);
CREATE POLICY "insert_expected_shipments" ON expected_shipments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update_expected_shipments" ON expected_shipments FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "delete_expected_shipments" ON expected_shipments FOR DELETE TO anon USING (true);