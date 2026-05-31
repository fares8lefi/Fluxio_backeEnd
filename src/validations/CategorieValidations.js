const validator = require('validator');

/** 
 * Validates user registration data.
 * @param {Object} data - The user data to validate.
 * @returns {Object} An object containing errors and a boolean indicating validity.
 */
const validateCategorieRegistration = (data) => {
    let errors = {};

    const { name, description } = data;

    // Username validation
    if (!name || validator.isEmpty(String(name).trim())) {
        errors.name = 'Name is required';
    }

    // Email validation
    if (!description || validator.isEmpty(String(description).trim())) {
        errors.description = 'Description is required';
    }

    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};

const validateCategorieUpdate = (data) => {
    let errors = {};
    const { name, code, description } = data;

    if (name !== undefined && validator.isEmpty(String(name).trim())) {
        errors.name = 'Name cannot be empty';
    }

    if (code !== undefined && validator.isEmpty(String(code).trim())) {
        errors.code = 'Code cannot be empty';
    }

    if (description !== undefined && validator.isEmpty(String(description).trim())) {
        errors.description = 'Description cannot be empty';
    }

    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};

module.exports = {
    validateCategorieRegistration,
    validateCategorieUpdate
};  