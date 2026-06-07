const { z } = require('zod');

// ─── Schemas ────────────────────────────────────────────────────────────────

const productRegistrationSchema = z.object({
    code: z
        .union([z.string(), z.number()])
        .transform((v) => parseInt(String(v).trim()))
        .refine((v) => !isNaN(v) && v > 0, { message: 'Le code doit être un entier positif' }),

    barcode: z
        .union([z.string(), z.number()])
        .transform((v) => parseInt(String(v).trim()))
        .refine((v) => !isNaN(v) && v > 0, { message: 'Le code-barres doit être un entier positif' }),

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

    // Renommé : unit → stock_quantity (quantité initiale en stock)
    stock_quantity: z
        .number({ invalid_type_error: 'La quantité en stock doit être un nombre entier positif' })
        .int('La quantité en stock doit être un nombre entier')
        .min(0, 'La quantité en stock doit être un nombre entier positif')
        .optional()
        .default(0),

    stock_min: z
        .number({ required_error: 'Le stock minimum est requis', invalid_type_error: 'Le stock minimum doit être un nombre entier positif' })
        .int('Le stock minimum doit être un nombre entier positif')
        .min(0, 'Le stock minimum doit être un nombre entier positif'),

    stock_max: z
        .number({ invalid_type_error: 'Le stock maximum doit être un nombre entier positif' })
        .int('Le stock maximum doit être un nombre entier')
        .min(0, 'Le stock maximum doit être un nombre entier positif')
        .optional()
        .nullable(),

    // TVA tunisienne : 0, 7, 13, ou 19%
    tva_rate: z
        .number({ invalid_type_error: 'Le taux TVA doit être un nombre' })
        .refine((v) => [0, 7, 13, 19].includes(v), { message: 'Taux TVA invalide. Valeurs acceptées : 0, 7, 13, 19' })
        .optional()
        .default(19),

    unit_of_measure: z
        .string()
        .trim()
        .min(1, "L'unité de mesure ne peut pas être vide")
        .optional()
        .default('pièce'),

    supplierId: z.string().trim().optional().nullable(),
    categoryId: z.string().trim().optional().nullable(),
});

const productUpdateSchema = z.object({
    code: z
        .union([z.string(), z.number()])
        .transform((v) => parseInt(String(v).trim()))
        .refine((v) => !isNaN(v) && v > 0, { message: 'Le code doit être un entier positif' })
        .optional(),

    barcode: z
        .union([z.string(), z.number()])
        .transform((v) => parseInt(String(v).trim()))
        .refine((v) => !isNaN(v) && v > 0, { message: 'Le code-barres doit être un entier positif' })
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

    stock_quantity: z
        .number({ invalid_type_error: 'La quantité en stock doit être un nombre entier' })
        .int('La quantité en stock doit être un nombre entier')
        .min(0, 'La quantité en stock doit être un nombre entier positif')
        .optional(),

    stock_min: z
        .number({ invalid_type_error: 'Le stock minimum doit être un nombre entier positif' })
        .int('Le stock minimum doit être un nombre entier positif')
        .min(0, 'Le stock minimum doit être un nombre entier positif')
        .optional(),

    stock_max: z
        .number({ invalid_type_error: 'Le stock maximum doit être un nombre entier positif' })
        .int('Le stock maximum doit être un nombre entier')
        .min(0, 'Le stock maximum doit être un nombre entier positif')
        .optional()
        .nullable(),

    tva_rate: z
        .number()
        .refine((v) => [0, 7, 13, 19].includes(v), { message: 'Taux TVA invalide. Valeurs acceptées : 0, 7, 13, 19' })
        .optional(),

    unit_of_measure: z.string().trim().min(1).optional(),
    supplierId:      z.string().trim().optional().nullable(),
    categoryId:      z.string().trim().optional().nullable(),
});

const productSearchSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'Le nom ne peut pas être vide')
        .optional(),

    // Renommé : unit → stock_quantity
    stock_quantity: z
        .coerce
        .number({ invalid_type_error: 'La quantité doit être un nombre entier' })
        .int('La quantité doit être un nombre entier')
        .min(0, 'La quantité doit être un nombre entier positif')
        .optional(),

    maxPrice: z
        .coerce
        .number({ invalid_type_error: 'Le prix maximum doit être un nombre positif' })
        .min(0, 'Le prix maximum doit être un nombre positif')
        .optional(),

    minPrice: z
        .coerce
        .number({ invalid_type_error: 'Le prix minimum doit être un nombre positif' })
        .min(0, 'Le prix minimum doit être un nombre positif')
        .optional(),
});

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Parse a Zod result into the legacy { errors, isValid, data } format.
 * @param {import('zod').SafeParseReturnType} result
 * @returns {{ errors: Object, isValid: boolean, data: any }}
 */
const formatResult = (result) => {
    if (result.success) {
        return { errors: {}, isValid: true, data: result.data };
    }
    const errors = {};
    result.error.issues.forEach(({ path, message }) => {
        const key = path[0];
        if (key && !errors[key]) {
            errors[key] = message;
        }
    });
    return { errors, isValid: false, data: null };
};

// ─── Exported validators ─────────────────────────────────────────────────────

const validateProductRegistration = (data) =>
    formatResult(productRegistrationSchema.safeParse(data));

const validateProductUpdate = (data) =>
    formatResult(productUpdateSchema.safeParse(data));

const validateProductSearch = (data) =>
    formatResult(productSearchSchema.safeParse(data));

module.exports = {
    validateProductRegistration,
    validateProductUpdate,
    validateProductSearch,
    productRegistrationSchema,
    productUpdateSchema,
    productSearchSchema,
};