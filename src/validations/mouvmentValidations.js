const { z } = require('zod');

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

/**
 * Regex pour valider un CUID (format Prisma par défaut).
 * Un CUID commence par 'c' suivi de caractères alphanumériques.
 * On accepte aussi les UUIDs pour flexibilité.
 */
const cuidRegex = /^[a-z0-9]{20,30}$/i;

const mouvmentItemSchema = z.object({
    productId: z
        .string({ required_error: 'Le produit (productId) est requis' })
        .trim()
        .min(1, 'Le produit (productId) est requis'),

    quantity: z
        .number({
            required_error: 'La quantité est requise',
            invalid_type_error: 'La quantité doit être un nombre entier',
        })
        .int('La quantité doit être un nombre entier')
        .min(1, 'La quantité doit être au minimum 1'),

    unit_price: z
        .number({ invalid_type_error: 'Le prix unitaire doit être un nombre positif' })
        .min(0, 'Le prix unitaire doit être un nombre positif')
        .optional()
        .nullable(),
});

// ─── Schemas ────────────────────────────────────────────────────────────────

const mouvmentRegistrationSchema = z.object({
    type: z.enum(
        ['IN', 'OUT', 'RETURN_SUPPLIER', 'RETURN_CLIENT'],
        {
            required_error: 'Le type de mouvement est requis',
            invalid_type_error:
                'Le type de mouvement est invalide. Valeurs acceptées: IN, OUT, RETURN_SUPPLIER, RETURN_CLIENT.',
        }
    ),

    items: z
        .array(mouvmentItemSchema, { required_error: 'Au moins un article est requis' })
        .min(1, 'Au moins un article est requis'),

    createdById: z
        .string({ required_error: "L'ID de l'utilisateur créateur est requis" })
        .trim()
        .min(1, "L'ID du créateur est requis"),

    supplierId: z
        .string()
        .trim()
        .min(1, "L'ID du fournisseur est invalide")
        .optional()
        .nullable(),

    clientId: z
        .string()
        .trim()
        .min(1, "L'ID du client est invalide")
        .optional()
        .nullable(),

    status: z
        .enum(
            ['PENDING', 'CONFIRMED', 'CANCELLED'],
            {
                invalid_type_error:
                    'Le statut est invalide. Valeurs acceptées: PENDING, CONFIRMED, CANCELLED.',
            }
        )
        .optional(),

    reference: z.string().trim().optional().nullable(),

    note: z.string().trim().optional().nullable(),
});

const mouvmentUpdateSchema = z.object({
    type: z
        .enum(
            ['IN', 'OUT', 'RETURN_SUPPLIER', 'RETURN_CLIENT'],
            {
                invalid_type_error:
                    'Le type de mouvement est invalide. Valeurs acceptées: IN, OUT, RETURN_SUPPLIER, RETURN_CLIENT.',
            }
        )
        .optional(),

    items: z
        .array(mouvmentItemSchema)
        .min(1, 'Au moins un article est requis si les articles sont modifiés')
        .optional(),

    supplierId: z
        .string()
        .trim()
        .min(1, "L'ID du fournisseur est invalide")
        .optional()
        .nullable(),

    status: z
        .enum(
            ['PENDING', 'CONFIRMED', 'CANCELLED'],
            {
                invalid_type_error:
                    'Le statut est invalide. Valeurs acceptées: PENDING, CONFIRMED, CANCELLED.',
            }
        )
        .optional(),

    reference: z.string().trim().optional().nullable(),

    note: z.string().trim().optional().nullable(),
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
        if (key !== undefined && !errors[key]) {
            errors[key] = message;
        }
    });
    return { errors, isValid: false };
};

// ─── Exported validators ─────────────────────────────────────────────────────

/**
 * Valide les données de création d'un mouvement.
 * @param {Object} data
 * @returns {{ errors: Object, isValid: boolean }}
 */
const validateMouvmentRegistration = (data) =>
    formatResult(mouvmentRegistrationSchema.safeParse(data));

/**
 * Valide les données de mise à jour d'un mouvement.
 * @param {Object} data
 * @returns {{ errors: Object, isValid: boolean }}
 */
const validateMouvmentUpdate = (data) =>
    formatResult(mouvmentUpdateSchema.safeParse(data));

module.exports = {
    validateMouvmentRegistration,
    validateMouvmentUpdate,
    mouvmentRegistrationSchema,
    mouvmentUpdateSchema,
    mouvmentItemSchema,
};
