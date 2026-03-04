-- Allow multiple processing jobs per file (run history)
-- Drop the UNIQUE constraint on file_id so reprocessing creates new rows

ALTER TABLE processing_jobs DROP CONSTRAINT IF EXISTS processing_jobs_file_id_key;

-- Non-unique index for lookups
CREATE INDEX IF NOT EXISTS idx_processing_jobs_file_id ON processing_jobs(file_id);
