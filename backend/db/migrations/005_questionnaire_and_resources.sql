-- Migration 005: Questionnaire, Book References, Virtual Lab Links & Manual Documents

-- 1. Questionnaire Items per Experiment Content Version (Max 5 enforced via validators & constraint)
CREATE TABLE IF NOT EXISTS experiment_questionnaire_items (
    question_id UUID PRIMARY KEY,
    content_version_id UUID NOT NULL REFERENCES experiment_content_versions(content_version_id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('boolean', 'text')),
    question_order INT NOT NULL CHECK (question_order >= 1 AND question_order <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (content_version_id, question_order)
);

-- 2. Student Session Questionnaire Responses with Strict Answer Type CHECK
CREATE TABLE IF NOT EXISTS student_questionnaire_responses (
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

-- 3. Book References per Experiment Content Version
CREATE TABLE IF NOT EXISTS experiment_book_references (
    reference_id UUID PRIMARY KEY,
    content_version_id UUID NOT NULL REFERENCES experiment_content_versions(content_version_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255),
    link TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Virtual Lab Links per Experiment Content Version
CREATE TABLE IF NOT EXISTS virtual_lab_links (
    link_id UUID PRIMARY KEY,
    content_version_id UUID NOT NULL REFERENCES experiment_content_versions(content_version_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    provider_name VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Manual Documents per Experiment Content Version (Link-only URL)
CREATE TABLE IF NOT EXISTS experiment_manual_documents (
    document_id UUID PRIMARY KEY,
    content_version_id UUID NOT NULL REFERENCES experiment_content_versions(content_version_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    document_url TEXT NOT NULL,
    file_type VARCHAR(50) DEFAULT 'pdf',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_questionnaire_items_content_version ON experiment_questionnaire_items(content_version_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_responses_session ON student_questionnaire_responses(student_session_id);
CREATE INDEX IF NOT EXISTS idx_book_references_content_version ON experiment_book_references(content_version_id);
CREATE INDEX IF NOT EXISTS idx_virtual_lab_links_content_version ON virtual_lab_links(content_version_id);
CREATE INDEX IF NOT EXISTS idx_manual_documents_content_version ON experiment_manual_documents(content_version_id);
