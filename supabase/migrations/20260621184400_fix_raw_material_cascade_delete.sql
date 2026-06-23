-- Fix missing ON DELETE CASCADE on shipments.raw_material_id
ALTER TABLE shipments
  DROP CONSTRAINT shipments_raw_material_id_fkey,
  ADD CONSTRAINT shipments_raw_material_id_fkey
    FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE CASCADE;

-- Fix missing ON DELETE CASCADE on inventory_entries.raw_material_id
ALTER TABLE inventory_entries
  DROP CONSTRAINT inventory_entries_raw_material_id_fkey,
  ADD CONSTRAINT inventory_entries_raw_material_id_fkey
    FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE CASCADE;
