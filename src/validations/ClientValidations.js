const { z } = require('zod');

// ─── Schemas ────────────────────────────────────────────────────────────────

const clientRegistrationSchema = z.object({
    name: z
        .string({ required_error: 'Le nom est obligatoire' })
        .trim()
        .min(1, 'Le nom est obligatoire'),

    phone: z
        .string({ required_error: 'Le numéro de téléphone est obligatoire' })
        .trim()
        .min(1, 'Le numéro de téléphone est obligatoire'),

    matriculeFiscale: z
        .string({ required_error: 'Le matricule fiscale est obligatoire' })
        .trim()
        .min(1, 'Le matricule fiscale est obligatoire'),

    // Correction : codeTva est une chaîne alphanumérique (ex: "0123456A/P/M000"), pas un Float
    codeTva: z
        .string({ invalid_type_error: 'Le code TVA doit être une chaîne de caractères' })
        .trim()
        .optional()
        .nullable(),
});

const clientUpdateSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'Le nom est obligatoire si fourni')
        .optional(),

    phone: z
        .string()
        .trim()
        .min(1, 'Le numéro de téléphone est obligatoire si fourni')
        .optional(),

    matriculeFiscale: z
        .string()
        .trim()
        .min(1, 'Le matricule fiscale ne peut pas être vide')
        .optional()
        .nullable(),

    // Correction : codeTva est une chaîne, pas un Float
    codeTva: z
        .string()
        .trim()
        .optional()
        .nullable(),

    is_active: z.boolean().optional(),
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
 * Valide les données de création d'un client.
 */
const validateClientRegistration = (data) =>
    formatResult(clientRegistrationSchema.safeParse(data));

/**
 * Valide les données de mise à jour d'un client.
 */
const validateClientUpdate = (data) =>
    formatResult(clientUpdateSchema.safeParse(data));

module.exports = {
    validateClientRegistration,
    validateClientUpdate,
    clientRegistrationSchema,
    clientUpdateSchema,
};
