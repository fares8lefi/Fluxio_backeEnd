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

const validateCategorieUpdate=(data)=>{
    let errors={};
    const { name,code}=data;
    if(!name || validator.isEmpty(String(name).trim())){
        errors.name='Name is required';
    }
    if(!code || validator.isEmpty(String(code).trim())){
        errors.code='Code is required';
    }
    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
}

module.exports = {
    validateCategorieRegistration,
    validateCategorieUpdate
};  