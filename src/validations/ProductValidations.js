const { z } = require('zod');

// ─── Schemas ────────────────────────────────────────────────────────────────

const productRegistrationSchema = z.object({
    code: z
        .union([z.string(), z.number()])
        .transform((v) => String(v).trim())
        .refine((v) => v.length > 0, { message: 'Le code est requis' })
        .refine((v) => /^\d+$/.test(v), { message: 'Le code doit être un nombre entier' }),

    barcode: z
        .union([z.string(), z.number()])
        .transform((v) => String(v).trim())
        .refine((v) => v.length > 0, { message: 'Le code-barres est requis' })
        .refine((v) => /^\d+$/.test(v), { message: 'Le code-barres doit être un nombre entier' }),

    name: z
        .string({ required_error: 'Le nom est requis' })
        .trim()
        .min(1, 'Le nom est requis'),

    purchase_price: z
        .number({ required_error: "Le prix d'achat est requis", invalid_type_error: "Le prix d'achat doit être un nombre positif" })
        .min(0, "Le prix d'achat doit être un nombre positif"),

    selling_price: z
        .number({ required_error: 'Le prix de vente est requis', invalid_type_error: 'Le prix de vente doit être un nombre positif' })
        .min(0, 'Le prix de vente doit être un nombre positif'),

    unit: z
        .number({ required_error: "L'unité/quantité est requise", invalid_type_error: "L'unité doit être un nombre entier positif" })
        .int("L'unité doit être un nombre entier positif")
        .min(0, "L'unité doit être un nombre entier positif"),

    stock_min: z
        .number({ required_error: 'Le stock minimum est requis', invalid_type_error: 'Le stock minimum doit être un nombre entier positif' })
        .int('Le stock minimum doit être un nombre entier positif')
        .min(0, 'Le stock minimum doit être un nombre entier positif'),
});

const productUpdateSchema = z.object({
    code: z
        .union([z.string(), z.number()])
        .transform((v) => String(v).trim())
        .refine((v) => v.length > 0, { message: 'Le code ne peut pas être vide' })
        .refine((v) => /^\d+$/.test(v), { message: 'Le code doit être un nombre entier' })
        .optional(),

    barcode: z
        .union([z.string(), z.number()])
        .transform((v) => String(v).trim())
        .refine((v) => v.length > 0, { message: 'Le code-barres ne peut pas être vide' })
        .refine((v) => /^\d+$/.test(v), { message: 'Le code-barres doit être un nombre entier' })
        .optional(),

    name: z
        .string()
        .trim()
        .min(1, 'Le nom ne peut pas être vide')
        .optional(),

    purchase_price: z
        .number({ invalid_type_error: "Le prix d'achat doit être un nombre positif" })
        .min(0, "Le prix d'achat doit être un nombre positif")
        .optional(),

    selling_price: z
        .number({ invalid_type_error: 'Le prix de vente doit être un nombre positif' })
        .min(0, 'Le prix de vente doit être un nombre positif')
        .optional(),

    unit: z
        .number({ invalid_type_error: "L'unité doit être un nombre entier positif" })
        .int("L'unité doit être un nombre entier positif")
        .min(0, "L'unité doit être un nombre entier positif")
        .optional(),

    stock_min: z
        .number({ invalid_type_error: 'Le stock minimum doit être un nombre entier positif' })
        .int('Le stock minimum doit être un nombre entier positif')
        .min(0, 'Le stock minimum doit être un nombre entier positif')
        .optional(),
});

const productSearchSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'Le nom ne peut pas être vide')
        .optional(),

    unit: z
        .number({ invalid_type_error: "L'unité doit être un nombre entier" })
        .int("L'unité doit être un nombre entier")
        .min(0, "L'unité doit être un nombre entier positif")
        .optional(),

    maxPrice: z
        .number({ invalid_type_error: 'Le prix maximum doit être un nombre positif' })
        .min(0, 'Le prix maximum doit être un nombre positif')
        .optional(),

    minPrice: z
        .number({ invalid_type_error: 'Le prix minimum doit être un nombre positif' })
        .min(0, 'Le prix minimum doit être un nombre positif')
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
 * Valide les données de création d'un produit.
 * @param {Object} data
 * @returns {{ errors: Object, isValid: boolean }}
 */
const validateProductRegistration = (data) =>
    formatResult(productRegistrationSchema.safeParse(data));

/**
 * Valide les données de mise à jour d'un produit.
 * @param {Object} data
 * @returns {{ errors: Object, isValid: boolean }}
 */
const validateProductUpdate = (data) =>
    formatResult(productUpdateSchema.safeParse(data));

/**
 * Valide les critères de recherche d'un produit.
 * @param {Object} data
 * @returns {{ errors: Object, isValid: boolean }}
 */
const validateProductSearch = (data) =>
    formatResult(productSearchSchema.safeParse(data));

module.exports = {
    validateProductRegistration,
    validateProductUpdate,
    validateProductSearch,
    // Expose schemas for reuse / testing
    productRegistrationSchema,
    productUpdateSchema,
    productSearchSchema,
};