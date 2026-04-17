const validator = require('validator');

/** 
 * Validates user registration data.
 * @param {Object} data - The user data to validate.
 * @returns {Object} An object containing errors and a boolean indicating validity.
 */
const validateSupplierRegistration = (data) => {
    let errors = {};
    const { name, email, phone, address } = data;

    if (!name || validator.isEmpty(String(name).trim())) {
        errors.name = 'Name is required';
    }

    if (!email || validator.isEmpty(String(email).trim())) {
        errors.email = 'Email is required';
    } else if (!validator.isEmail(email)) {
        errors.email = 'Email is invalid';
    }

    if (!phone || validator.isEmpty(String(phone).trim())) {
        errors.phone = 'Phone is required';
    }

    if (!address || validator.isEmpty(String(address).trim())) {
        errors.address = 'Address is required';
    }

    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};


/** 
 * Validates user registration data.
 * @param {Object} data - The user data to validate.
 * @returns {Object} An object containing errors and a boolean indicating validity.
 */