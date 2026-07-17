CREATE OR REPLACE FUNCTION maintain_current_quantity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE raw_materials
    SET current_quantity = current_quantity +
      (CASE WHEN NEW.movement_type = 'IN' THEN NEW.quantity ELSE -NEW.quantity END)
    WHERE id = NEW.raw_material_id;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.raw_material_id = NEW.raw_material_id THEN
      UPDATE raw_materials
      SET current_quantity = current_quantity
        - (CASE WHEN OLD.movement_type = 'IN' THEN OLD.quantity ELSE -OLD.quantity END)
        + (CASE WHEN NEW.movement_type = 'IN' THEN NEW.quantity ELSE -NEW.quantity END)
      WHERE id = NEW.raw_material_id;
    ELSE
      UPDATE raw_materials
      SET current_quantity = current_quantity
        - (CASE WHEN OLD.movement_type = 'IN' THEN OLD.quantity ELSE -OLD.quantity END)
      WHERE id = OLD.raw_material_id;

      UPDATE raw_materials
      SET current_quantity = current_quantity
        + (CASE WHEN NEW.movement_type = 'IN' THEN NEW.quantity ELSE -NEW.quantity END)
      WHERE id = NEW.raw_material_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE raw_materials
    SET current_quantity = current_quantity
      - (CASE WHEN OLD.movement_type = 'IN' THEN OLD.quantity ELSE -OLD.quantity END)
    WHERE id = OLD.raw_material_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;