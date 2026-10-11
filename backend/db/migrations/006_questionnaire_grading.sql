-- Migration 006: Questionnaire Correct Answers, Grading & Evaluation

-- 1. Add correct answers and marks to experiment_questionnaire_items
ALTER TABLE experiment_questionnaire_items
ADD COLUMN IF NOT EXISTS correct_answer_boolean BOOLEAN,
ADD COLUMN IF NOT EXISTS correct_answer_text TEXT,
ADD COLUMN IF NOT EXISTS marks INT DEFAULT 1;

-- 2. Add grading fields to student_questionnaire_responses
ALTER TABLE student_questionnaire_responses
ADD COLUMN IF NOT EXISTS is_correct BOOLEAN,
ADD COLUMN IF NOT EXISTS marks_awarded INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMP WITH TIME ZONE;
