const validator = require('validator');

/** 
 * Validates product registration data.
 * @param {Object} data - The product data to validate.
 * @returns {Object} An object containing errors and a boolean indicating validity.
 */
const validateProductRegistration = (data) => {
    let errors = {};

    const { name, description, price, quantity, categorie } = data;

    // Name validation
    if (!name || validator.isEmpty(String(name).trim())) {
        errors.name = 'Name is required';
    }

    // Description validation
    if (!description || validator.isEmpty(String(description).trim())) {
        errors.description = 'Description is required';
    }

    // Price validation
    if (!price || validator.isEmpty(String(price).trim())) {
        errors.price = 'Price is required';
    } else if (!validator.isFloat(price, { min: 0 })) {
        errors.price = 'Price must be a non-negative number';
    }

    // Quantity validation
    if (!quantity || validator.isEmpty(String(quantity).trim())) {
        errors.quantity = 'Quantity is required';
    } else if (!validator.isInt(quantity, { min: 0 })) {
        errors.quantity = 'Quantity must be a non-negative integer';
    }

    // Categorie validation
    if (!categorie || validator.isEmpty(String(categorie).trim())) {
        errors.categorie = 'Categorie is required';
    }

    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};


module.exports = {
    validateProductRegistration,
    
};      