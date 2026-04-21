const validator = require('validator');

/** 
 * Valide les données de création d'un mouvement.
 */
const validateMouvmentRegistration = (data) => {
    let errors = {};

    const { type, items, supplier, warehouse_from, warehouse_to, created_by, status, reference, note } = data;

    if (!type || validator.isEmpty(String(type).trim())) {
        errors.type = 'Le type de mouvement est requis';
    } else if (!['IN', 'OUT', 'TRANSFER', 'RETURN_SUPPLIER', 'RETURN_CLIENT'].includes(type)) {
        errors.type = 'Le type de mouvement est invalide. Valeurs acceptées: IN, OUT, TRANSFER, RETURN_SUPPLIER, RETURN_CLIENT.';
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
        errors.items = 'Au moins un article est requis';
    } else {
        const hasInvalidItem = items.some(item => 
            !item.product || validator.isEmpty(String(item.product).trim()) || !validator.isMongoId(String(item.product)) ||
            item.quantity === undefined || !validator.isInt(String(item.quantity), { min: 1 }) ||
            (item.unit_price !== undefined && item.unit_price !== null && !validator.isEmpty(String(item.unit_price).trim()) && !validator.isFloat(String(item.unit_price), { min: 0 }))
        );
        if (hasInvalidItem) {
            errors.items = 'Chaque article doit avoir un produit valide (MongoID), une quantité (minimum 1) et un prix unitaire optionnellement positif';
        }
    }

    if (!created_by || validator.isEmpty(String(created_by).trim())) {
        errors.created_by = "L'ID de l'utilisateur créateur est requis (created_by)";
    } else if (!validator.isMongoId(String(created_by))) {
        errors.created_by = "L'ID du créateur est invalide";
    }

    if (supplier !== undefined && supplier !== null && !validator.isEmpty(String(supplier).trim()) && !validator.isMongoId(String(supplier))) {
        errors.supplier = "L'ID du fournisseur est invalide";
    }

    if (warehouse_from !== undefined && warehouse_from !== null && !validator.isEmpty(String(warehouse_from).trim()) && !validator.isMongoId(String(warehouse_from))) {
        errors.warehouse_from = "L'ID de l'entrepôt d'origine est invalide";
    }

    if (warehouse_to !== undefined && warehouse_to !== null && !validator.isEmpty(String(warehouse_to).trim()) && !validator.isMongoId(String(warehouse_to))) {
        errors.warehouse_to = "L'ID de l'entrepôt de destination est invalide";
    }

    if (status !== undefined && status !== null && validator.isEmpty(String(status).trim()) === false) {
        if (!['PENDING', 'CONFIRMED', 'CANCELLED'].includes(status)) {
            errors.status = 'Le statut est invalide. Valeurs acceptées: PENDING, CONFIRMED, CANCELLED.';
        }
    }

    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};

/**
 * Valide les données de mise à jour d'un mouvement.
 */
const validateMouvmentUpdate = (data) => {
    let errors = {};
    const { type, items, supplier, warehouse_from, warehouse_to, status, reference, note } = data;

    if (type !== undefined) {
        if (validator.isEmpty(String(type).trim())) {
             errors.type = 'Le type ne peut pas être vide';
        } else if (!['IN', 'OUT', 'TRANSFER', 'RETURN_SUPPLIER', 'RETURN_CLIENT'].includes(type)) {
            errors.type = 'Le type de mouvement est invalide. Valeurs acceptées: IN, OUT, TRANSFER, RETURN_SUPPLIER, RETURN_CLIENT.';
        }
    }

    if (items !== undefined) {
        if (!Array.isArray(items) || items.length === 0) {
            errors.items = 'Au moins un article est requis si les articles sont modifiés';
        } else {
            const hasInvalidItem = items.some(item => 
                !item.product || validator.isEmpty(String(item.product).trim()) || !validator.isMongoId(String(item.product)) ||
                item.quantity === undefined || !validator.isInt(String(item.quantity), { min: 1 }) ||
                (item.unit_price !== undefined && item.unit_price !== null && !validator.isEmpty(String(item.unit_price).trim()) && !validator.isFloat(String(item.unit_price), { min: 0 }))
            );
            if (hasInvalidItem) {
                errors.items = 'Certains articles sont invalides (produit requis (MongoID), quantité >= 1, prix unitaire optionnel positif)';
            }
        }
    }

    if (supplier !== undefined && supplier !== null && !validator.isEmpty(String(supplier).trim()) && !validator.isMongoId(String(supplier))) {
        errors.supplier = "L'ID du fournisseur est invalide";
    }

    if (warehouse_from !== undefined && warehouse_from !== null && !validator.isEmpty(String(warehouse_from).trim()) && !validator.isMongoId(String(warehouse_from))) {
        errors.warehouse_from = "L'ID de l'entrepôt d'origine est invalide";
    }

    if (warehouse_to !== undefined && warehouse_to !== null && !validator.isEmpty(String(warehouse_to).trim()) && !validator.isMongoId(String(warehouse_to))) {
        errors.warehouse_to = "L'ID de l'entrepôt de destination est invalide";
    }

    if (status !== undefined) {
         if (validator.isEmpty(String(status).trim())) {
              errors.status = 'Le statut ne peut pas être vide';
         } else if (!['PENDING', 'CONFIRMED', 'CANCELLED'].includes(status)) {
            errors.status = 'Le statut est invalide. Valeurs acceptées: PENDING, CONFIRMED, CANCELLED.';
        }
    }

    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};

module.exports = {
    validateMouvmentRegistration,
    validateMouvmentUpdate
};
