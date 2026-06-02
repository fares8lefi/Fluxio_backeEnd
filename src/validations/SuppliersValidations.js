const { z } = require('zod');

// ─── Schemas ────────────────────────────────────────────────────────────────

const supplierRegistrationSchema = z.object({
    name: z
        .string({ required_error: 'Name is required' })
        .trim()
        .min(1, 'Name is required'),

    email: z
        .string({ required_error: 'Email is required' })
        .trim()
        .min(1, 'Email is required')
        .email('Email is invalid'),

    phone: z
        .string({ required_error: 'Phone is required' })
        .trim()
        .min(1, 'Phone is required'),

    address: z
        .string({ required_error: 'Address is required' })
        .trim()
        .min(1, 'Address is required'),
});

const supplierUpdateSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'Name is required if provided')
        .optional(),

    email: z
        .string()
        .trim()
        .email('Email is invalid')
        .optional(),

    phone: z
        .string()
        .trim()
        .min(1, 'Phone is required if provided')
        .optional(),

    address: z
        .string()
        .trim()
        .min(1, 'Address is required if provided')
        .optional(),
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
 * Valide les données de création d'un fournisseur.
 * @param {Object} data
 * @returns {{ errors: Object, isValid: boolean }}
 */
const validateSupplierRegistration = (data) =>
    formatResult(supplierRegistrationSchema.safeParse(data));

/**
 * Valide les données de mise à jour d'un fournisseur.
 * @param {Object} data
 * @returns {{ errors: Object, isValid: boolean }}
 */
const validateSupplierUpdate = (data) =>
    formatResult(supplierUpdateSchema.safeParse(data));

module.exports = {
    validateSupplierRegistration,
    validateSupplierUpdate,
    // Expose schemas for reuse / testing
    supplierRegistrationSchema,
    supplierUpdateSchema,
};