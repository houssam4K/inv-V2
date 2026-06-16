
-- Production lines
CREATE TABLE production_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Products
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  line_id uuid NOT NULL REFERENCES production_lines(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Teams
CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  line_id uuid NOT NULL REFERENCES production_lines(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (name, line_id)
);

-- Daily production entries: one row per team per product per date
CREATE TABLE production_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  date date NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (product_id, team_id, date)
);

-- Seed production lines
INSERT INTO production_lines (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', '5.5L Line'),
  ('22222222-2222-2222-2222-222222222222', '1.5L / 0.5L Line');

-- Seed products
INSERT INTO products (id, name, line_id) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '1.5L Bottles', '22222222-2222-2222-2222-222222222222'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '5.5L Bottles', '11111111-1111-1111-1111-111111111111'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '0.5L Bottles', '22222222-2222-2222-2222-222222222222');

-- Seed teams (3 per line)
INSERT INTO teams (id, name, line_id) VALUES
  ('11111112-1111-1111-1111-111111111111', 'Team 1', '11111111-1111-1111-1111-111111111111'),
  ('11111113-1111-1111-1111-111111111111', 'Team 2', '11111111-1111-1111-1111-111111111111'),
  ('11111114-1111-1111-1111-111111111111', 'Team 3', '11111111-1111-1111-1111-111111111111'),
  ('22222223-2222-2222-2222-222222222222', 'Team 1', '22222222-2222-2222-2222-222222222222'),
  ('22222224-2222-2222-2222-222222222222', 'Team 2', '22222222-2222-2222-2222-222222222222'),
  ('22222225-2222-2222-2222-222222222222', 'Team 3', '22222222-2222-2222-2222-222222222222');

-- Enable RLS
ALTER TABLE production_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users (full CRUD)
CREATE POLICY "select_production_lines" ON production_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_production_lines" ON production_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_production_lines" ON production_lines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_production_lines" ON production_lines FOR DELETE TO authenticated USING (true);

CREATE POLICY "select_products" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_products" ON products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_products" ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_products" ON products FOR DELETE TO authenticated USING (true);

CREATE POLICY "select_teams" ON teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_teams" ON teams FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_teams" ON teams FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_teams" ON teams FOR DELETE TO authenticated USING (true);

CREATE POLICY "select_production_entries" ON production_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_production_entries" ON production_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_production_entries" ON production_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_production_entries" ON production_entries FOR DELETE TO authenticated USING (true);
