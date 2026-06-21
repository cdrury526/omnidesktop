-- Migration 0003 — persist the open tab bar across restarts.
-- The `tabs` table existed from 0001 but was never wired up. Add the columns
-- that link each tab row to a conversation and/or a pending project folder.

ALTER TABLE tabs ADD COLUMN conversation_id INTEGER;
ALTER TABLE tabs ADD COLUMN working_dir TEXT;
