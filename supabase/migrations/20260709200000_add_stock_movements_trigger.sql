CREATE OR REPLACE FUNCTION maintain_current_quantity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    UPDATE raw_materials 
    SET current_quantity = COALESCE((
      SELECT SUM(CASE WHEN movement_type = 'IN' THEN quantity ELSE -quantity END)
      FROM stock_movements
      WHERE raw_material_id = NEW.raw_material_id
    ), 0)
    WHERE id = NEW.raw_material_id;
  END IF;
  
  IF TG_OP IN ('DELETE', 'UPDATE') THEN
    IF TG_OP = 'DELETE' OR OLD.raw_material_id <> NEW.raw_material_id THEN
      UPDATE raw_materials 
      SET current_quantity = COALESCE((
        SELECT SUM(CASE WHEN movement_type = 'IN' THEN quantity ELSE -quantity END)
        FROM stock_movements
        WHERE raw_material_id = OLD.raw_material_id
      ), 0)
      WHERE id = OLD.raw_material_id;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER maintain_current_quantity_trigger
AFTER INSERT OR UPDATE OR DELETE ON stock_movements
FOR EACH ROW EXECUTE FUNCTION maintain_current_quantity();
