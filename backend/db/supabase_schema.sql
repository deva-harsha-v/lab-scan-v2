-- ==============================================================================
-- LabScan v2 - Complete Unified Supabase PostgreSQL Schema
-- Run this entire script in Supabase SQL Editor for a brand-new database.
-- ==============================================================================

-- Drop existing tables if re-initializing (cascade drops dependent constraints/views)
DROP TABLE IF EXISTS student_questionnaire_responses CASCADE;
DROP TABLE IF EXISTS experiment_questionnaire_items CASCADE;
DROP TABLE IF EXISTS experiment_book_references CASCADE;
DROP TABLE IF EXISTS virtual_lab_links CASCADE;
DROP TABLE IF EXISTS experiment_manual_documents CASCADE;
DROP TABLE IF EXISTS student_checklist_progress CASCADE;
DROP TABLE IF EXISTS student_sessions CASCADE;
DROP TABLE IF EXISTS checklist_items CASCADE;
DROP TABLE IF EXISTS experiment_content_versions CASCADE;
DROP TABLE IF EXISTS experiments CASCADE;
DROP TABLE IF EXISTS lab_branches CASCADE;
DROP TABLE IF EXISTS labs CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS institutions CASCADE;
DROP TABLE IF EXISTS schema_migrations CASCADE;

-- 1. Trigger function for updating updated_at columns
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Schema Migrations Tracking (Keeps backend migration runner happy)
CREATE TABLE schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_migrations (version) VALUES 
('001_initial_schema.sql'),
('002_lockout_and_tokens.sql'),
('003_aruco_verification.sql'),
('004_single_session_login.sql'),
('005_questionnaire_and_resources.sql')
ON CONFLICT DO NOTHING;

-- 3. Institutions
CREATE TABLE institutions (
    institution_id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    logo TEXT,
    short_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_institutions_modtime 
    BEFORE UPDATE ON institutions 
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 4. Branches
CREATE TABLE branches (
    branch_id UUID PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_branches_modtime 
    BEFORE UPDATE ON branches 
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 5. Users
CREATE TABLE users (
    user_id UUID PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'student')),
    full_name VARCHAR(255),
    roll_number VARCHAR(100) UNIQUE,
    branch_id UUID REFERENCES branches(branch_id) ON DELETE SET NULL,
    institution_id UUID REFERENCES institutions(institution_id) ON DELETE SET NULL,
    force_password_change BOOLEAN DEFAULT FALSE,
    failed_attempts INT DEFAULT 0,
    lockout_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    current_session_id VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_users_modtime 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 6. Refresh Tokens
CREATE TABLE refresh_tokens (
    token_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Labs
CREATE TABLE labs (
    lab_id UUID PRIMARY KEY,
    lab_name VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255) DEFAULT 'Block 4, Room 302',
    admin_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_labs_modtime 
    BEFORE UPDATE ON labs 
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 8. LabBranches (Many-to-Many relationship between Labs and Branches)
CREATE TABLE lab_branches (
    lab_id UUID NOT NULL REFERENCES labs(lab_id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(branch_id) ON DELETE CASCADE,
    PRIMARY KEY (lab_id, branch_id)
);

-- 9. Experiments
CREATE TABLE experiments (
    experiment_id UUID PRIMARY KEY,
    lab_id UUID NOT NULL REFERENCES labs(lab_id) ON DELETE CASCADE,
    experiment_name VARCHAR(255) NOT NULL,
    description TEXT,
    ar_qr_marker_id INTEGER UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_experiments_modtime 
    BEFORE UPDATE ON experiments 
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 10. Experiment Content Versions
CREATE TABLE experiment_content_versions (
    content_version_id UUID PRIMARY KEY,
    experiment_id UUID NOT NULL REFERENCES experiments(experiment_id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    theory_procedure_json JSONB NOT NULL,
    video_links JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (experiment_id, version_number)
);

-- 11. Checklist Items
CREATE TABLE checklist_items (
    checklist_item_id UUID PRIMARY KEY,
    content_version_id UUID NOT NULL REFERENCES experiment_content_versions(content_version_id) ON DELETE CASCADE,
    item_text TEXT NOT NULL,
    item_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (content_version_id, item_order)
);

-- 12. Student Sessions
CREATE TABLE student_sessions (
    session_id UUID PRIMARY KEY,
    student_id UUID NOT NULL,
    experiment_id UUID NOT NULL,
    content_version_id UUID NOT NULL REFERENCES experiment_content_versions(content_version_id) ON DELETE RESTRICT,
    aruco_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    learning_stage_completed_at TIMESTAMP WITH TIME ZONE,
    visual_stage_completed_at TIMESTAMP WITH TIME ZONE,
    checklist_completed_at TIMESTAMP WITH TIME ZONE,
    session_started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_completed_at TIMESTAMP WITH TIME ZONE,
    current_video_progress JSONB,
    UNIQUE (student_id, content_version_id),
    CONSTRAINT fk_student_sessions_student FOREIGN KEY (student_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_student_sessions_experiment FOREIGN KEY (experiment_id) REFERENCES experiments(experiment_id) ON DELETE RESTRICT
);

-- 13. Student Checklist Progress
CREATE TABLE student_checklist_progress (
    student_session_id UUID NOT NULL REFERENCES student_sessions(session_id) ON DELETE CASCADE,
    checklist_item_id UUID NOT NULL REFERENCES checklist_items(checklist_item_id) ON DELETE CASCADE,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (student_session_id, checklist_item_id)
);

-- 14. Questionnaire Items per Experiment (Max 5 enforced via validators & constraint)
CREATE TABLE experiment_questionnaire_items (
    question_id UUID PRIMARY KEY,
    content_version_id UUID NOT NULL REFERENCES experiment_content_versions(content_version_id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('boolean', 'text')),
    question_order INT NOT NULL CHECK (question_order >= 1 AND question_order <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (content_version_id, question_order)
);

-- 15. Student Questionnaire Responses
CREATE TABLE student_questionnaire_responses (
    student_session_id UUID NOT NULL REFERENCES student_sessions(session_id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES experiment_questionnaire_items(question_id) ON DELETE CASCADE,
    answer_boolean BOOLEAN,
    answer_text TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (student_session_id, question_id),
    CONSTRAINT chk_answer_type CHECK (
        (answer_boolean IS NOT NULL AND answer_text IS NULL) OR 
        (answer_text IS NOT NULL AND answer_boolean IS NULL)
    )
);

-- 16. Book References per Experiment
CREATE TABLE experiment_book_references (
    reference_id UUID PRIMARY KEY,
    content_version_id UUID NOT NULL REFERENCES experiment_content_versions(content_version_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255),
    link TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 17. Virtual Lab Links per Experiment
CREATE TABLE virtual_lab_links (
    link_id UUID PRIMARY KEY,
    content_version_id UUID NOT NULL REFERENCES experiment_content_versions(content_version_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    provider_name VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. Manual Documents per Experiment
CREATE TABLE experiment_manual_documents (
    document_id UUID PRIMARY KEY,
    content_version_id UUID NOT NULL REFERENCES experiment_content_versions(content_version_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    document_url TEXT NOT NULL,
    file_type VARCHAR(50) DEFAULT 'pdf',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 19. Audit Logs
CREATE TABLE audit_logs (
    log_id UUID PRIMARY KEY,
    actor_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL,
    target_type VARCHAR(100),
    target_id UUID,
    details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for high-performance lookups
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_experiments_lab_id ON experiments(lab_id);
CREATE INDEX idx_experiment_content_versions_experiment_id ON experiment_content_versions(experiment_id);
CREATE INDEX idx_student_sessions_student_id ON student_sessions(student_id);
CREATE INDEX idx_student_sessions_experiment_id ON student_sessions(experiment_id);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_questionnaire_items_content_version ON experiment_questionnaire_items(content_version_id);
CREATE INDEX idx_questionnaire_responses_session ON student_questionnaire_responses(student_session_id);
CREATE INDEX idx_book_references_content_version ON experiment_book_references(content_version_id);
CREATE INDEX idx_virtual_lab_links_content_version ON virtual_lab_links(content_version_id);
CREATE INDEX idx_manual_documents_content_version ON experiment_manual_documents(content_version_id);

-- ==============================================================================
-- 20. Initial Default Seed Data (Admin Account & Institution)
-- Default Admin login:
-- Username: admin
-- Password: Password@123
-- ==============================================================================
INSERT INTO institutions (institution_id, name, short_name, logo) 
VALUES ('11111111-1111-1111-1111-111111111111', 'Engineering College', 'EC', '')
ON CONFLICT DO NOTHING;

INSERT INTO branches (branch_id, name) VALUES 
('22222222-2222-2222-2222-222222222221', 'CSE'),
('22222222-2222-2222-2222-222222222222', 'ECE'),
('22222222-2222-2222-2222-222222222223', 'Mechanical')
ON CONFLICT DO NOTHING;

-- Admin user (Password: Password@123)
INSERT INTO users (
    user_id, 
    username, 
    password_hash, 
    role, 
    full_name, 
    institution_id, 
    force_password_change
) VALUES (
    '33333333-3333-3333-3333-333333333333',
    'admin',
    '$2a$10$ViMUqQE7cScNRD8lJqlCdOVKJFQLrNknR6oyGBV9vTXZYDSTpSMcG', 
    'admin',
    'System Administrator',
    '11111111-1111-1111-1111-111111111111',
    FALSE
) ON CONFLICT (username) DO NOTHING;
