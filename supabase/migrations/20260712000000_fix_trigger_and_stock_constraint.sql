-- Drop old trigger first to avoid conflicts with the previous incremental approach
DROP TRIGGER IF EXISTS maintain_current_quantity_trigger ON stock_movements;

-- Replace function with the safe recalculate-from-scratch approach (self-correcting)
CREATE OR REPLACE FUNCTION maintain_current_quantity()
RETURNS TRIGGER AS $$
DECLARE
  target_id uuid;
BEGIN
  -- For UPDATE where raw_material_id changed, update the OLD material too
  IF TG_OP = 'UPDATE' AND OLD.raw_material_id <> NEW.raw_material_id THEN
    UPDATE raw_materials
    SET current_quantity = COALESCE((
      SELECT SUM(CASE WHEN movement_type = 'IN' THEN quantity ELSE -quantity END)
      FROM stock_movements
      WHERE raw_material_id = OLD.raw_material_id
    ), 0)
    WHERE id = OLD.raw_material_id;
  END IF;

  -- For DELETE, update old material
  IF TG_OP = 'DELETE' THEN
    target_id := OLD.raw_material_id;
  ELSE
    target_id := NEW.raw_material_id;
  END IF;

  UPDATE raw_materials
  SET current_quantity = COALESCE((
    SELECT SUM(CASE WHEN movement_type = 'IN' THEN quantity ELSE -quantity END)
    FROM stock_movements
    WHERE raw_material_id = target_id
  ), 0)
  WHERE id = target_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger as AFTER (correct for recalculate approach)
CREATE TRIGGER maintain_current_quantity_trigger
AFTER INSERT OR UPDATE OR DELETE ON stock_movements
FOR EACH ROW EXECUTE FUNCTION maintain_current_quantity();

-- Prevent current_quantity from going negative (server-side guard)
ALTER TABLE raw_materials
  ADD CONSTRAINT current_quantity_non_negative
  CHECK (current_quantity >= 0);
