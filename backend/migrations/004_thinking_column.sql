-- Add thinking column to agent_messages (UI-only, never sent to LLM)
ALTER TABLE agent_messages ADD COLUMN IF NOT EXISTS thinking TEXT;
