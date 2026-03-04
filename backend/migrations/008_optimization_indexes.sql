-- Optimization indexes for common query patterns

-- Workspace access checks join organizations on owner_id (every request)
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_id);

-- Full-text search uses trigram similarity on file names
CREATE INDEX IF NOT EXISTS idx_files_name_trgm ON files USING GIN(name gin_trgm_ops);
