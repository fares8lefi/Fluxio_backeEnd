const { z } = require('zod');

// ─── Schemas ────────────────────────────────────────────────────────────────

const categorieRegistrationSchema = z.object({
    name: z
        .string({ required_error: 'Le nom de la catégorie est requis' })
        .trim()
        .min(1, 'Le nom de la catégorie est requis'),

    code: z
        .union([z.string(), z.number()])
        .transform((v) => parseInt(String(v).trim()))
        .refine((v) => !isNaN(v) && v > 0, { message: 'Le code doit être un entier positif' }),

    description: z
        .string()
        .trim()
        .optional()
        .nullable(),
});

const categorieUpdateSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'Le nom ne peut pas être vide')
        .optional(),

    code: z
        .union([z.string(), z.number()])
        .transform((v) => parseInt(String(v).trim()))
        .refine((v) => !isNaN(v) && v > 0, { message: 'Le code doit être un entier positif' })
        .optional(),

    description: z
        .string()
        .trim()
        .optional()
        .nullable(),
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
 */
const validateCategorieRegistration = (data) =>
    formatResult(categorieRegistrationSchema.safeParse(data));

/**
 * Valide les données de mise à jour d'une catégorie.
 */
const validateCategorieUpdate = (data) =>
    formatResult(categorieUpdateSchema.safeParse(data));

module.exports = {
    validateCategorieRegistration,
    validateCategorieUpdate,
    categorieRegistrationSchema,
    categorieUpdateSchema,
};