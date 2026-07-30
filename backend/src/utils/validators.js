const { z } = require('zod');

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
  branch_id: z.string().uuid('Branch ID must be a valid UUID.'),
  password: passwordSchema
});

const editStudentSchema = z.object({
  user_id: z.string().uuid('User ID must be a valid UUID.'),
  full_name: z.string().trim().min(1, 'Full name is required.'),
  branch_id: z.string().uuid('Branch ID must be a valid UUID.')
});

const resetPasswordSchema = z.object({
  user_id: z.string().uuid('User ID must be a valid UUID.'),
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
  allowed_branches: z.array(z.string().uuid('Branch ID must be a valid UUID.')).default([])
});

// Experiments schemas
const videoLinkSchema = z.object({
  id: z.string().optional(),
  type: z.string().default('youtube'),
  url: z.string().url('Video URL must be a valid URL.'),
  title: z.string().trim().min(1, 'Video title is required.'),
  min_duration: z.number().nonnegative().optional().default(0)
});

const experimentSchema = z.object({
  lab_id: z.string().uuid('Lab ID must be a valid UUID.').optional(), // Optional on update
  experiment_name: z.string().trim().min(1, 'Experiment name is required.'),
  description: z.string().trim().optional().default(''),
  ar_qr_marker_id: z.coerce.number().int().min(0).max(99, 'Marker ID must be between 0 and 99.'),
  theory_procedure_json: z.array(z.any()).optional(),
  video_links: z.array(videoLinkSchema).optional().default([]),
  checklist_items: z.array(z.string().trim()).optional().default([])
});

// Sessions schemas
const sessionStartSchema = z.object({
  experiment_id: z.string().uuid('Experiment ID must be a valid UUID.')
});

const sessionChecklistItemSchema = z.object({
  session_id: z.string().uuid('Session ID must be a valid UUID.'),
  checklist_item_id: z.string().uuid('Checklist Item ID must be a valid UUID.'),
  is_completed: z.boolean()
});

const sessionSignoffSchema = z.object({
  session_id: z.string().uuid('Session ID must be a valid UUID.')
});

const sessionVerifyArucoSchema = z.object({
  experiment_id: z.string().uuid('Experiment ID must be a valid UUID.'),
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
  sessionStartSchema,
  sessionChecklistItemSchema,
  sessionSignoffSchema,
  sessionVerifyArucoSchema,
  branchSchema,
  passwordSchema
};
