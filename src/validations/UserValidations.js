const validator = require('validator');

/**
 * Validates user registration data.
 * @param {Object} data - The user data to validate.
 * @returns {Object} An object containing errors and a boolean indicating validity.
 */
const validateUserRegistration = (data) => {
    let errors = {};

    const { username, email, password, phone } = data;

    // Username validation
    if (!username || validator.isEmpty(String(username).trim())) {
        errors.username = 'Username is required';
    }

    // Email validation
    if (!email || validator.isEmpty(String(email).trim())) {
        errors.email = 'Email is required';
    } else if (!validator.isEmail(email)) {
        errors.email = 'Email is invalid';
    }

    // Password validation
    if (!password || validator.isEmpty(String(password).trim())) {
        errors.password = 'Password is required';
    } else if (!validator.isLength(password, { min: 8 })) {
        errors.password = 'Password must be at least 8 characters';
    }

    // Phone validation
    if (!phone || validator.isEmpty(String(phone).trim())) {
        errors.phone = 'Phone number is required';
    } else if (!validator.isMobilePhone(phone)) {
        errors.phone = 'Phone number is invalid';
    }

    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};

/**
 * Validates user update data.
 * @param {Object} data - The user data to validate.
 * @returns {Object} An object containing errors and a boolean indicating validity.
 */
const validateUserUpdate = (data) => {
    let errors = {};
    const { email, phone } = data;

    if (email && !validator.isEmail(email)) {
        errors.email = 'Email is invalid';
    }

    if (phone && !validator.isMobilePhone(phone)) {
        errors.phone = 'Phone number is invalid';
    }

    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};

/**
 * Validates password strength.
 * @param {string} password - The password to validate.
 * @returns {Object} An object containing errors and a boolean indicating validity.
 */
const validatePassword = (password) => {
    let errors = {};

    if (!password || validator.isEmpty(String(password).trim())) {
        errors.password = 'Password is required';
    } else if (!validator.isLength(password, { min: 8 })) {
        errors.password = 'Password must be at least 8 characters';
    }

    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};

/**
 * Validates login data.
 * @param {Object} data - The login data to validate.
 * @returns {Object} An object containing errors and a boolean indicating validity.
 */
const validateLogin = (data) => {
    let errors = {};
    const { email, password } = data;

    if (!email || validator.isEmpty(String(email).trim())) {
        errors.email = 'Email is required';
    } else if (!validator.isEmail(email)) {
        errors.email = 'Email is invalid';
    }

    if (!password || validator.isEmpty(String(password).trim())) {
        errors.password = 'Password is required';
    }

    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};

module.exports = {
    validateUserRegistration,
    validateUserUpdate,
    validatePassword,
    validateLogin
};

