const { z } = require('zod');



const userRegistrationSchema = z.object({
    username: z
        .string({ required_error: 'Username is required' })
        .trim()
        .min(1, 'Username is required'),

    email: z
        .string({ required_error: 'Email is required' })
        .trim()
        .min(1, 'Email is required')
        .email('Email is invalid'),

    password: z
        .string({ required_error: 'Password is required' })
        .min(1, 'Password is required')
        .min(8, 'Password must be at least 8 characters'),

    phone: z
        .string({ required_error: 'Phone number is required' })
        .trim()
        .min(1, 'Phone number is required')
        .regex(/^\+?[0-9\s\-().]{6,20}$/, 'Phone number is invalid'),

    company_name: z
        .string({ required_error: 'Company name is required' })
        .trim()
        .min(1, 'Company name is required'),
});

const userUpdateSchema = z.object({
    email: z.string().trim().email('Email is invalid').optional(),
    phone: z
        .string()
        .trim()
        .regex(/^\+?[0-9\s\-().]{6,20}$/, 'Phone number is invalid')
        .optional(),
});

const passwordSchema = z.object({
    password: z
        .string({ required_error: 'Password is required' })
        .min(1, 'Password is required')
        .min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
    email: z
        .string({ required_error: 'Email is required' })
        .trim()
        .min(1, 'Email is required')
        .email('Email is invalid'),

    password: z
        .string({ required_error: 'Password is required' })
        .min(1, 'Password is required'),
});

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Parse a Zod result into the legacy { errors, isValid } format.
 * @param {import('zod').SafeParseReturnType} result
 * @returns {{ errors: Object, isValid: boolean }}
 */
const formatResult = (result) => {
    if (result.success) {
        return { errors: {}, isValid: true };
    }
    const errors = {};
    result.error.issues.forEach(({ path, message }) => {
        const key = path[0];
        if (key && !errors[key]) {
            errors[key] = message;
        }
    });
    return { errors, isValid: false };
};

// ─── Exported validators ─────────────────────────────────────────────────────

/**
 * Validates user registration data.
 * @param {Object} data
 * @returns {{ errors: Object, isValid: boolean }}
 */
const validateUserRegistration = (data) =>
    formatResult(userRegistrationSchema.safeParse(data));

/**
 * Validates user update data (all fields optional).
 * @param {Object} data
 * @returns {{ errors: Object, isValid: boolean }}
 */
const validateUserUpdate = (data) =>
    formatResult(userUpdateSchema.safeParse(data));

/**
 * Validates password strength.
 * @param {string} password
 * @returns {{ errors: Object, isValid: boolean }}
 */
const validatePassword = (password) =>
    formatResult(passwordSchema.safeParse({ password }));

/**
 * Validates login data.
 * @param {Object} data
 * @returns {{ errors: Object, isValid: boolean }}
 */
const validateLogin = (data) =>
    formatResult(loginSchema.safeParse(data));

module.exports = {
    validateUserRegistration,
    validateUserUpdate,
    validatePassword,
    validateLogin,
    // Expose schemas for reuse / testing
    userRegistrationSchema,
    userUpdateSchema,
    passwordSchema,
    loginSchema,
};
