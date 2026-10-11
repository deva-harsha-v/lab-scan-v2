const { z } = require('zod');

// Flexible PostgreSQL-compatible UUID schema (accepts any valid 8-4-4-4-12 hex UUID format)
const uuidSchema = (label = 'ID') => z.string().trim().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  `${label} must be a valid UUID.`
);

// Password complexity schema
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters long.')
  .refine(val => /[A-Z]/.test(val), 'Password must contain at least one uppercase letter.')
  .refine(val => /[a-z]/.test(val), 'Password must contain at least one lowercase letter.')
  .refine(val => /\d/.test(val), 'Password must contain at least one number.')
  .refine(val => /[@$!%*?&#_.\-]/.test(val), 'Password must contain at least one special character.');

// Auth schemas
const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required.'),
  password: z.string().min(1, 'Password is required.')
});

const registerStudentSchema = z.object({
  full_name: z.string().trim().min(1, 'Full name is required.'),
  roll_number: z.string().trim().min(1, 'Roll number is required.'),
  branch_id: uuidSchema('Branch ID'),
  password: passwordSchema
});

const editStudentSchema = z.object({
  user_id: uuidSchema('User ID'),
  full_name: z.string().trim().min(1, 'Full name is required.'),
  branch_id: uuidSchema('Branch ID')
});

const resetPasswordSchema = z.object({
  user_id: uuidSchema('User ID'),
  password: passwordSchema
});

const updateProfileSchema = z.object({
  username: z.string().trim().min(1, 'Username is required.'),
  full_name: z.string().trim().min(1, 'Full name is required.'),
  password: passwordSchema.optional().or(z.literal('')), // Optional password
  institution_name: z.string().trim().min(1, 'Institution name is required.'),
  institution_short_name: z.string().trim().min(1, 'Institution acronym is required.')
});

// Labs schemas
const labSchema = z.object({
  lab_name: z.string().trim().min(1, 'Lab name is required.'),
  description: z.string().trim().optional().default(''),
  location: z.string().trim().optional().default('Block 4, Room 302'),
  allowed_branches: z.array(uuidSchema('Branch ID')).default([])
});

// Experiments schemas
const videoLinkSchema = z.object({
  id: z.string().optional(),
  type: z.string().default('youtube'),
  url: z.string().url('Video URL must be a valid URL.'),
  title: z.string().trim().min(1, 'Video title is required.'),
  min_duration: z.number().nonnegative().optional().default(0)
});

const questionnaireItemSchema = z.object({
  question_text: z.string().trim().min(1, 'Question text is required.'),
  question_type: z.enum(['boolean', 'text'], { errorMap: () => ({ message: 'Question type must be boolean or text.' }) }),
  question_order: z.number().int().min(1).max(5, 'Question order must be between 1 and 5.'),
  correct_answer_boolean: z.boolean().nullable().optional(),
  correct_answer_text: z.string().trim().nullable().optional(),
  marks: z.coerce.number().int().min(1).optional().default(1)
});

const bookReferenceSchema = z.object({
  title: z.string().trim().min(1, 'Book title is required.'),
  author: z.string().trim().optional().default(''),
  link: z.string().url('Book link must be a valid URL.')
});

const virtualLabLinkSchema = z.object({
  title: z.string().trim().min(1, 'Virtual lab title is required.'),
  url: z.string().url('Virtual lab URL must be a valid URL.'),
  provider_name: z.string().trim().optional().default(''),
  description: z.string().trim().optional().default('')
});

const manualDocumentSchema = z.object({
  title: z.string().trim().min(1, 'Document title is required.'),
  document_url: z.string().url('Document URL must be a valid URL.'),
  file_type: z.string().trim().optional().default('pdf')
});

const experimentSchema = z.object({
  lab_id: uuidSchema('Lab ID').optional(), // Optional on update
  experiment_name: z.string().trim().min(1, 'Experiment name is required.'),
  description: z.string().trim().optional().default(''),
  ar_qr_marker_id: z.coerce.number().int().min(0).max(99, 'Marker ID must be between 0 and 99.'),
  theory_procedure_json: z.array(z.any()).optional(),
  video_links: z.array(videoLinkSchema).optional().default([]),
  checklist_items: z.array(z.string().trim()).optional().default([]),
  questionnaire_items: z.array(questionnaireItemSchema).max(5, 'Maximum 5 questionnaire questions allowed.').optional().default([]),
  book_references: z.array(bookReferenceSchema).optional().default([]),
  virtual_lab_links: z.array(virtualLabLinkSchema).optional().default([]),
  manual_documents: z.array(manualDocumentSchema).optional().default([])
}).refine(data => {
  if (!data.questionnaire_items || data.questionnaire_items.length === 0) return true;
  const orders = data.questionnaire_items.map(q => q.question_order).sort((a, b) => a - b);
  // Check contiguous 1..N sequence
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) return false;
  }
  return true;
}, {
  message: 'Questionnaire item orders must form a strict contiguous sequence starting at 1 (1, 2, 3...).',
  path: ['questionnaire_items']
});

// Sessions schemas
const sessionStartSchema = z.object({
  experiment_id: uuidSchema('Experiment ID')
});

const sessionChecklistItemSchema = z.object({
  session_id: uuidSchema('Session ID'),
  checklist_item_id: uuidSchema('Checklist Item ID'),
  is_completed: z.boolean()
});

const sessionQuestionnaireSubmissionSchema = z.object({
  session_id: uuidSchema('Session ID'),
  answers: z.array(z.object({
    question_id: uuidSchema('Question ID'),
    answer_boolean: z.boolean().nullable().optional(),
    answer_text: z.string().nullable().optional()
  })).min(1, 'At least one answer must be submitted.')
});

const sessionQuestionnaireRevealSchema = z.object({
  session_id: uuidSchema('Session ID'),
  answers: z.array(z.object({
    question_id: uuidSchema('Question ID'),
    answer_boolean: z.boolean().nullable().optional(),
    answer_text: z.string().nullable().optional()
  })).optional().default([])
});

const sessionSignoffSchema = z.object({
  session_id: uuidSchema('Session ID')
});

const sessionVerifyArucoSchema = z.object({
  experiment_id: uuidSchema('Experiment ID'),
  scanned_marker_id: z.coerce.number().int().min(0).max(99)
});

// Branches schemas
const branchSchema = z.object({
  name: z.string().trim().min(1, 'Branch name is required.')
});

// Validation middleware generator
const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed: ' + result.error.issues.map(e => e.message).join(' '),
      details: result.error.issues.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
    });
  }
  req.body = result.data;
  next();
};

module.exports = {
  validateBody,
  loginSchema,
  registerStudentSchema,
  editStudentSchema,
  resetPasswordSchema,
  updateProfileSchema,
  labSchema,
  experimentSchema,
  questionnaireItemSchema,
  bookReferenceSchema,
  virtualLabLinkSchema,
  manualDocumentSchema,
  sessionStartSchema,
  sessionChecklistItemSchema,
  sessionQuestionnaireSubmissionSchema,
  sessionQuestionnaireRevealSchema,
  sessionSignoffSchema,
  sessionVerifyArucoSchema,
  branchSchema,
  passwordSchema
};
