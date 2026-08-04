-- Supabase PostgreSQL Schema for LabScan
-- Drop existing tables if they exist (cascade deletes dependent views/constraints)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS student_checklist_progress CASCADE;
DROP TABLE IF EXISTS student_sessions CASCADE;
DROP TABLE IF EXISTS checklist_items CASCADE;
DROP TABLE IF EXISTS experiment_content_versions CASCADE;
DROP TABLE IF EXISTS experiments CASCADE;
DROP TABLE IF EXISTS lab_branches CASCADE;
DROP TABLE IF EXISTS labs CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS institutions CASCADE;

-- Trigger function to auto-update updated_at columns
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table: Institutions
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

-- Table: Branches
CREATE TABLE branches (
    branch_id UUID PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_branches_modtime 
    BEFORE UPDATE ON branches 
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Table: Users
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_users_modtime 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Table: Labs
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

-- Table: LabBranches (many-to-many relationship)
CREATE TABLE lab_branches (
    lab_id UUID NOT NULL REFERENCES labs(lab_id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(branch_id) ON DELETE CASCADE,
    PRIMARY KEY (lab_id, branch_id)
);

-- Table: Experiments
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

-- Table: ExperimentContentVersions
CREATE TABLE experiment_content_versions (
    content_version_id UUID PRIMARY KEY,
    experiment_id UUID NOT NULL REFERENCES experiments(experiment_id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    theory_procedure_json JSONB NOT NULL,
    video_links JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (experiment_id, version_number)
);

-- Table: ChecklistItems
CREATE TABLE checklist_items (
    checklist_item_id UUID PRIMARY KEY,
    content_version_id UUID NOT NULL REFERENCES experiment_content_versions(content_version_id) ON DELETE CASCADE,
    item_text TEXT NOT NULL,
    item_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (content_version_id, item_order)
);

-- Table: StudentSessions
CREATE TABLE student_sessions (
    session_id UUID PRIMARY KEY,
    student_id UUID NOT NULL,
    experiment_id UUID NOT NULL,
    content_version_id UUID NOT NULL REFERENCES experiment_content_versions(content_version_id) ON DELETE RESTRICT,
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

-- Table: StudentChecklistProgress
CREATE TABLE student_checklist_progress (
    student_session_id UUID NOT NULL REFERENCES student_sessions(session_id) ON DELETE CASCADE,
    checklist_item_id UUID NOT NULL REFERENCES checklist_items(checklist_item_id) ON DELETE CASCADE,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (student_session_id, checklist_item_id)
);

-- Table: AuditLogs
CREATE TABLE audit_logs (
    log_id UUID PRIMARY KEY,
    actor_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL,
    target_type VARCHAR(100),
    target_id UUID,
    details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_experiments_lab_id ON experiments(lab_id);
CREATE INDEX idx_experiment_content_versions_experiment_id ON experiment_content_versions(experiment_id);
CREATE INDEX idx_student_sessions_student_id ON student_sessions(student_id);
CREATE INDEX idx_student_sessions_experiment_id ON student_sessions(experiment_id);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);

-- Table: RefreshTokens
CREATE TABLE refresh_tokens (
    token_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
