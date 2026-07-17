-- 1a. Champs légaux manquants sur suppliers
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS nif text,
  ADD COLUMN IF NOT EXISTS rc text,
  ADD COLUMN IF NOT EXISTS art_number text,
  ADD COLUMN IF NOT EXISTS address text;

-- 1b. En-tête des documents générés (BC ou BR)
CREATE TABLE IF NOT EXISTS supplier_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type text NOT NULL CHECK (doc_type IN ('BC', 'BR')),
  number text NOT NULL,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  date date NOT NULL,
  -- Champs spécifiques BR (références commande liée)
  v_commande text,
  n_commande text,
  -- Champs spécifiques BC
  mode_paiement text,
  delai_livraison text,
  lieu_livraison text,
  tva_rate numeric DEFAULT 19,
  observations text,
  created_at timestamptz DEFAULT now(),
  -- Un même numéro ne peut pas être réutilisé pour le même type de document (BC ou BR)
  CONSTRAINT supplier_documents_type_number_unique UNIQUE (doc_type, number)
);

-- Enable RLS
ALTER TABLE supplier_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_supplier_documents" ON supplier_documents FOR SELECT TO anon USING (true);
CREATE POLICY "insert_supplier_documents" ON supplier_documents FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update_supplier_documents" ON supplier_documents FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "delete_supplier_documents" ON supplier_documents FOR DELETE TO anon USING (true);


-- 1c. Lignes d'articles (communes aux deux types)
CREATE TABLE IF NOT EXISTS supplier_document_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES supplier_documents(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  code text,
  designation text NOT NULL,
  quantity numeric NOT NULL,
  unit text,
  unit_price numeric
);

-- Enable RLS
ALTER TABLE supplier_document_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_supplier_document_items" ON supplier_document_items FOR SELECT TO anon USING (true);
CREATE POLICY "insert_supplier_document_items" ON supplier_document_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update_supplier_document_items" ON supplier_document_items FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "delete_supplier_document_items" ON supplier_document_items FOR DELETE TO anon USING (true);


-- 7bis. Regrouper les lignes par bon dans la situation emballage
ALTER TABLE packaging_transactions
  ADD COLUMN IF NOT EXISTS bon_number text,
  ADD COLUMN IF NOT EXISTS batch_id uuid;
