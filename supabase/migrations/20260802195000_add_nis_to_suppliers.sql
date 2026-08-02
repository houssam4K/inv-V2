-- Add NIS (Numéro d'Identification Statistique) column to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS nis text;
