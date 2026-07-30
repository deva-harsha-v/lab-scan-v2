-- 002_lockout_and_tokens.sql
-- Idempotent migration to add user lockout, refresh tokens, and restrict constraints

-- Add brute-force lockout columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lockout_until TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Table: RefreshTokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
    token_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for refresh tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- Drop the old default constraints (Postgres auto-generated and Phase 1 names)
ALTER TABLE student_sessions DROP CONSTRAINT IF EXISTS student_sessions_student_id_fkey;
ALTER TABLE student_sessions DROP CONSTRAINT IF EXISTS student_sessions_experiment_id_fkey;
ALTER TABLE student_sessions DROP CONSTRAINT IF EXISTS fk_student_sessions_student;
ALTER TABLE student_sessions DROP CONSTRAINT IF EXISTS fk_student_sessions_experiment;

-- Add constraints with explicit names and ON DELETE RESTRICT for database-level academic record retention
ALTER TABLE student_sessions ADD CONSTRAINT fk_student_sessions_student FOREIGN KEY (student_id) REFERENCES users(user_id) ON DELETE RESTRICT;
ALTER TABLE student_sessions ADD CONSTRAINT fk_student_sessions_experiment FOREIGN KEY (experiment_id) REFERENCES experiments(experiment_id) ON DELETE RESTRICT;
