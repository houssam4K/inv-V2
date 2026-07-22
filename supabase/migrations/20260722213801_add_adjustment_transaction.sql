DO $$ 
DECLARE
    r record;
BEGIN
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.check_constraints 
        WHERE constraint_schema = 'public' 
          AND constraint_name LIKE '%packaging_transactions%transaction_type%'
    ) LOOP
        EXECUTE 'ALTER TABLE packaging_transactions DROP CONSTRAINT ' || r.constraint_name;
    END LOOP;
    
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.check_constraints 
        WHERE constraint_schema = 'public' 
          AND constraint_name LIKE '%packaging_transactions%quantity%'
    ) LOOP
        EXECUTE 'ALTER TABLE packaging_transactions DROP CONSTRAINT ' || r.constraint_name;
    END LOOP;
END $$;

ALTER TABLE packaging_transactions ADD CONSTRAINT packaging_transactions_transaction_type_check 
  CHECK (transaction_type IN ('SENT', 'RETURNED', 'ADJUSTMENT'));

-- Allow quantity to be any non-zero integer for adjustments
ALTER TABLE packaging_transactions ADD CONSTRAINT packaging_transactions_quantity_check 
  CHECK (
    (transaction_type IN ('SENT', 'RETURNED') AND quantity > 0) OR
    (transaction_type = 'ADJUSTMENT' AND quantity != 0)
  );
