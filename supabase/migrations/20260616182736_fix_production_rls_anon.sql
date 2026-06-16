
-- Drop authenticated policies
DROP POLICY "select_production_lines" ON production_lines;
DROP POLICY "insert_production_lines" ON production_lines;
DROP POLICY "update_production_lines" ON production_lines;
DROP POLICY "delete_production_lines" ON production_lines;

DROP POLICY "select_products" ON products;
DROP POLICY "insert_products" ON products;
DROP POLICY "update_products" ON products;
DROP POLICY "delete_products" ON products;

DROP POLICY "select_teams" ON teams;
DROP POLICY "insert_teams" ON teams;
DROP POLICY "update_teams" ON teams;
DROP POLICY "delete_teams" ON teams;

DROP POLICY "select_production_entries" ON production_entries;
DROP POLICY "insert_production_entries" ON production_entries;
DROP POLICY "update_production_entries" ON production_entries;
DROP POLICY "delete_production_entries" ON production_entries;

-- Re-create with anon role
CREATE POLICY "select_production_lines" ON production_lines FOR SELECT TO anon USING (true);
CREATE POLICY "insert_production_lines" ON production_lines FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update_production_lines" ON production_lines FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "delete_production_lines" ON production_lines FOR DELETE TO anon USING (true);

CREATE POLICY "select_products" ON products FOR SELECT TO anon USING (true);
CREATE POLICY "insert_products" ON products FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update_products" ON products FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "delete_products" ON products FOR DELETE TO anon USING (true);

CREATE POLICY "select_teams" ON teams FOR SELECT TO anon USING (true);
CREATE POLICY "insert_teams" ON teams FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update_teams" ON teams FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "delete_teams" ON teams FOR DELETE TO anon USING (true);

CREATE POLICY "select_production_entries" ON production_entries FOR SELECT TO anon USING (true);
CREATE POLICY "insert_production_entries" ON production_entries FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update_production_entries" ON production_entries FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "delete_production_entries" ON production_entries FOR DELETE TO anon USING (true);
