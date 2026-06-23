CREATE TABLE notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content text NOT NULL,
  author text,
  color text DEFAULT 'bg-yellow-200',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_notes" ON notes FOR SELECT TO anon USING (true);
CREATE POLICY "insert_notes" ON notes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update_notes" ON notes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "delete_notes" ON notes FOR DELETE TO anon USING (true);
