-- Migration 0002 — per-conversation Code mode.
-- Binds a chat to a working folder so the agent can be grounded in a project.
-- `code_mode` is the toggle; `working_dir` is the absolute path the user picked
-- (NULL until chosen). File access stays behind Rust; this only stores the path
-- and feeds it into the agent's system prompt.

ALTER TABLE conversations ADD COLUMN code_mode INTEGER NOT NULL DEFAULT 0;
ALTER TABLE conversations ADD COLUMN working_dir TEXT;
