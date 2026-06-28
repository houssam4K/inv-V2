CREATE TABLE IF NOT EXISTS bom_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        uuid NOT NULL
                      REFERENCES products(id) ON DELETE CASCADE,
  raw_material_id   uuid NOT NULL
                      REFERENCES raw_materials(id) ON DELETE CASCADE,
  unit_type         text NOT NULL
                      CHECK (unit_type IN (
                        'per_bottle',
                        'per_fardeau',
                        'per_pallet',
                        'unknown'
                      )),
  quantity_per_unit numeric,
  created_at        timestamptz DEFAULT now(),
  UNIQUE (product_id, raw_material_id)
);
