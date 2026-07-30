const { test, describe } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

// Load environment variables for testing context
process.env.JWT_ACCESS_SECRET = 'testaccesssecretkey123!testaccesssecretkey123!';
process.env.JWT_REFRESH_SECRET = 'testrefreshsecretkey123!testrefreshsecretkey123!';

const { passwordSchema, registerStudentSchema } = require('../src/utils/validators');
const { convertQuery } = require('../src/config/db');

describe('LabScan Backend Integration Tests', () => {

  describe('Password Complexity Schema Validation', () => {
    test('Should pass for a strong, complex password', () => {
      const result = passwordSchema.safeParse('SecureP@ss123!');
      assert.strictEqual(result.success, true);
    });

    test('Should fail for passwords under 8 characters', () => {
      const result = passwordSchema.safeParse('SecP@s1');
      assert.strictEqual(result.success, false);
      assert.ok(result.error.issues.some(i => i.message.includes('at least 8 characters')));
    });

    test('Should fail for passwords without special characters', () => {
      const result = passwordSchema.safeParse('SecurePassword123');
      assert.strictEqual(result.success, false);
      assert.ok(result.error.issues.some(i => i.message.includes('special character')));
    });

    test('Should fail for passwords without uppercase letters', () => {
      const result = passwordSchema.safeParse('securep@ss123!');
      assert.strictEqual(result.success, false);
      assert.ok(result.error.issues.some(i => i.message.includes('uppercase letter')));
    });

    test('Should fail for passwords without lowercase letters', () => {
      const result = passwordSchema.safeParse('SECUREP@SS123!');
      assert.strictEqual(result.success, false);
      assert.ok(result.error.issues.some(i => i.message.includes('lowercase letter')));
    });
  });

  describe('Student Registration Schema Validation', () => {
    test('Should pass for valid student registration payload', () => {
      const payload = {
        full_name: 'John Doe',
        roll_number: 'roll_123',
        branch_id: '5003666d-1cf1-4560-bf6a-4933a3528b7a',
        password: 'SecureP@ss123!'
      };
      const result = registerStudentSchema.safeParse(payload);
      assert.strictEqual(result.success, true);
    });

    test('Should reject invalid UUID for branch_id', () => {
      const payload = {
        full_name: 'John Doe',
        roll_number: 'roll_123',
        branch_id: 'invalid-uuid-format',
        password: 'SecureP@ss123!'
      };
      const result = registerStudentSchema.safeParse(payload);
      assert.strictEqual(result.success, false);
      assert.ok(result.error.issues.some(i => i.message.includes('valid UUID')));
    });
  });

  describe('convertQuery Database Parameter Shim', () => {
    test('Should convert MySQL style ? parameters to Postgres style $1, $2', () => {
      const sql = 'SELECT * FROM users WHERE username = ? AND role = ?';
      const converted = convertQuery(sql);
      assert.strictEqual(converted, 'SELECT * FROM users WHERE username = $1 AND role = $2');
    });

    test('Should bypass question marks inside string literals', () => {
      const sql = "SELECT * FROM users WHERE full_name = 'Who ?' AND status = ?";
      const converted = convertQuery(sql);
      assert.strictEqual(converted, "SELECT * FROM users WHERE full_name = 'Who ?' AND status = $1");
    });
  });

  describe('JWT Utility Validation', () => {
    test('Should sign and verify JWT tokens correctly', () => {
      const payload = { user_id: '123', role: 'student' };
      const token = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
      
      const verified = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      assert.strictEqual(verified.user_id, '123');
      assert.strictEqual(verified.role, 'student');
    });

    test('Should reject tokens signed with an incorrect key', () => {
      const payload = { user_id: '123' };
      const token = jwt.sign(payload, 'wrong_secret_key_string_here_123', { expiresIn: '15m' });
      
      assert.throws(() => {
        jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      });
    });
  });

});
