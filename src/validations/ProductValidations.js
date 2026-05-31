const validator = require('validator');

/** 
 * Valide les données de création d'un produit.
 */
const validateProductRegistration = (data) => {
    let errors = {};

    const { code, barcode, name, purchase_price, selling_price, unit, stock_min } = data;

    if (!code || validator.isEmpty(String(code).trim())) {
        errors.code = 'Le code est requis';
    } else if (!validator.isInt(String(code))) {
        errors.code = 'Le code doit être un nombre entier';
    }

    if (!barcode || validator.isEmpty(String(barcode).trim())) {
        errors.barcode = 'Le code-barres est requis';
    } else if (!validator.isInt(String(barcode))) {
        errors.barcode = 'Le code-barres doit être un nombre entier';
    }

    if (!name || validator.isEmpty(String(name).trim())) {
        errors.name = 'Le nom est requis';
    }

    if (purchase_price === undefined || validator.isEmpty(String(purchase_price).trim())) {
        errors.purchase_price = 'Le prix d\'achat est requis';
    } else if (!validator.isFloat(String(purchase_price), { min: 0 })) {
        errors.purchase_price = 'Le prix d\'achat doit être un nombre positif';
    }

    if (selling_price === undefined || validator.isEmpty(String(selling_price).trim())) {
        errors.selling_price = 'Le prix de vente est requis';
    } else if (!validator.isFloat(String(selling_price), { min: 0 })) {
        errors.selling_price = 'Le prix de vente doit être un nombre positif';
    }

    if (unit === undefined || validator.isEmpty(String(unit).trim())) {
        errors.unit = 'L\'unité/quantité est requise';
    } else if (!validator.isInt(String(unit), { min: 0 })) {
        errors.unit = 'L\'unité doit être un nombre entier positif';
    }

    if (stock_min === undefined || validator.isEmpty(String(stock_min).trim())) {
        errors.stock_min = 'Le stock minimum est requis';
    } else if (!validator.isInt(String(stock_min), { min: 0 })) {
        errors.stock_min = 'Le stock minimum doit être un nombre entier positif';
    }

    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};

/**
 * Valide les données de mise à jour d'un produit.
 */
const validateProductUpdate = (data) => {
    let errors = {};
    const { code, barcode, name, purchase_price, selling_price, unit, stock_min } = data;

    if (code !== undefined && validator.isEmpty(String(code).trim())) {
        errors.code = 'Le code ne peut pas être vide';
    } else if (code !== undefined && !validator.isInt(String(code))) {
        errors.code = 'Le code doit être un nombre entier';
    }

    if (barcode !== undefined && validator.isEmpty(String(barcode).trim())) {
        errors.barcode = 'Le code-barres ne peut pas être vide';
    } else if (barcode !== undefined && !validator.isInt(String(barcode))) {
        errors.barcode = 'Le code-barres doit être un nombre entier';
    }

    if (name !== undefined && validator.isEmpty(String(name).trim())) {
        errors.name = 'Le nom ne peut pas être vide';
    }

    if (purchase_price !== undefined) {
        if (!validator.isFloat(String(purchase_price), { min: 0 })) {
            errors.purchase_price = 'Le prix d\'achat doit être un nombre positif';
        }
    }

    if (selling_price !== undefined) {
        if (!validator.isFloat(String(selling_price), { min: 0 })) {
            errors.selling_price = 'Le prix de vente doit être un nombre positif';
        }
    }

    if (unit !== undefined) {
        if (!validator.isInt(String(unit), { min: 0 })) {
            errors.unit = 'L\'unité doit être un nombre entier positif';
        }
    }

    if (stock_min !== undefined) {
        if (!validator.isInt(String(stock_min), { min: 0 })) {
            errors.stock_min = 'Le stock minimum doit être un nombre entier positif';
        }
    }

    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};

const validateProductSearch = (data) => {
    const{name,unit,maxPrice,minPrice} = data;
    let errors={}
    if (name !== undefined && validator.isEmpty(String(name).trim())) {
        errors.name='Le nom ne peut pas être vide';
    }
    if (unit !== undefined && validator.isEmpty(String(unit).trim())) {
        errors.unit='Le code ne peut pas être vide';
    } else if (code !== undefined && !validator.isInt(String(unit))) {
        errors.unit='Le code doit être un nombre entier';
    }
    if (maxPrice !== undefined && validator.isEmpty(String(maxPrice).trim())) {
        errors.maxPrice='Le prix maximum ne peut pas être vide';
    } else if (maxPrice !== undefined && !validator.isFloat(String(maxPrice), { min: 0 })) {
        errors.maxPrice='Le prix maximum doit être un nombre positif';
    }
    if (minPrice !== undefined && validator.isEmpty(String(minPrice).trim())) {
        errors.minPrice='Le prix minimum ne peut pas être vide';
    } else if (minPrice !== undefined && !validator.isFloat(String(minPrice), { min: 0 })) {
        errors.minPrice='Le prix minimum doit être un nombre positif';
    }
    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
}

    




module.exports = {
    validateProductRegistration,
    validateProductUpdate,
    validateProductSearch
};