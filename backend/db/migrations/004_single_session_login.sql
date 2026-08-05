-- 004_single_session_login.sql
-- Add current_session_id column to users table to support single active session validation
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_session_id VARCHAR(255) DEFAULT NULL;
