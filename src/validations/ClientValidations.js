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
        .string()
        .trim()
        .optional()
        .nullable(),

    codeTva: z
        .number({ invalid_type_error: 'Le code TVA doit être un nombre' })
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
        .optional()
        .nullable(),

    codeTva: z
        .number({ invalid_type_error: 'Le code TVA doit être un nombre' })
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
 * Valide les données de création d'un client.
 * @param {Object} data
 * @returns {{ errors: Object, isValid: boolean }}
 */
const validateClientRegistration = (data) =>
    formatResult(clientRegistrationSchema.safeParse(data));

/**
 * Valide les données de mise à jour d'un client.
 * @param {Object} data
 * @returns {{ errors: Object, isValid: boolean }}
 */
const validateClientUpdate = (data) =>
    formatResult(clientUpdateSchema.safeParse(data));

module.exports = {
    validateClientRegistration,
    validateClientUpdate,
    clientRegistrationSchema,
    clientUpdateSchema,
};
