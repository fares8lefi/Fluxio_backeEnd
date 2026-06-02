const { z } = require('zod');

// ─── Schemas ────────────────────────────────────────────────────────────────

const categorieRegistrationSchema = z.object({
    name: z
        .string({ required_error: 'Name is required' })
        .trim()
        .min(1, 'Name is required'),

    description: z
        .string({ required_error: 'Description is required' })
        .trim()
        .min(1, 'Description is required'),
});

const categorieUpdateSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'Name cannot be empty')
        .optional(),

    code: z
        .string()
        .trim()
        .min(1, 'Code cannot be empty')
        .optional(),

    description: z
        .string()
        .trim()
        .min(1, 'Description cannot be empty')
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
 * Valide les données de création d'une catégorie.
 * @param {Object} data
 * @returns {{ errors: Object, isValid: boolean }}
 */
const validateCategorieRegistration = (data) =>
    formatResult(categorieRegistrationSchema.safeParse(data));

/**
 * Valide les données de mise à jour d'une catégorie.
 * @param {Object} data
 * @returns {{ errors: Object, isValid: boolean }}
 */
const validateCategorieUpdate = (data) =>
    formatResult(categorieUpdateSchema.safeParse(data));

module.exports = {
    validateCategorieRegistration,
    validateCategorieUpdate,
    // Expose schemas for reuse / testing
    categorieRegistrationSchema,
    categorieUpdateSchema,
};