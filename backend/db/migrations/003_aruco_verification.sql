-- 003_aruco_verification.sql
-- Add aruco_verified_at column to student_sessions table
ALTER TABLE student_sessions ADD COLUMN IF NOT EXISTS aruco_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
