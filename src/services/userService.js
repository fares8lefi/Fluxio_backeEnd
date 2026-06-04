// Logique métier des utilisateurs : les appels findOne() directs sont remplacés par le repository ; userModel est conservé uniquement pour ses méthodes statiques bcrypt (login, verifPasswordUser).
const userRepository = require('../repositories/userRepository');
const userModel = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendEmailVerificationCode, sendEmailResetCode } = require('./SendEmail');
const { validateUserRegistration, validateUserUpdate, validatePassword, validateLogin } = require('../validations/UserValidations');

const maxTime = 240 * 60 * 60;

const createToken = (id) => {
    return jwt.sign({ id }, process.env.net_Secret, { expiresIn: maxTime });
};

const createUser = async (data) => {
    const { errors, isValid } = validateUserRegistration(data);
    if (!isValid) {
        const error = new Error('Validation échouée');
        error.statusCode = 400;
        error.details = errors;
        throw error;
    }

    const { username, password, phone, email } = data;
    const code = Math.floor(1000 + Math.random() * 9000);

    await Promise.all([
        userRepository.create({ username, email, password, phone, code, is_active: false }),
        sendEmailVerificationCode(email, username, code),
    ]);
};

const verifyAccounts = async (email, code) => {
    const user = await userRepository.findOneByEmail(email);
    if (!user) {
        const error = new Error('Utilisateur introuvable');
        error.statusCode = 404;
        throw error;
    }

    if (String(user.code) !== String(code)) {
        const error = new Error('Code invalide');
        error.statusCode = 400;
        throw error;
    }

    user.is_active = true;
    user.code = null;
    await user.save();
};

const resendCode = async (email) => {
    // Need full doc with code field — use model directly (select includes code)
    const user = await userModel.findOne({ email });
    if (!user) {
        const error = new Error('Utilisateur introuvable');
        error.statusCode = 404;
        throw error;
    }

    const code = Math.floor(1000 + Math.random() * 9000);
    user.code = code;
    await user.save();

    await sendEmailVerificationCode(email, user.username, code);
};

const forgetPasswordVerifyCode = async (email, newPassword) => {
    const { errors, isValid } = validatePassword(newPassword);
    if (!isValid) {
        const error = new Error('Validation échouée');
        error.statusCode = 400;
        error.details = errors;
        throw error;
    }

    // Need full doc with code field to mutate it
    const user = await userModel.findOne({ email });
    if (!user) {
        const error = new Error('Utilisateur introuvable');
        error.statusCode = 404;
        throw error;
    }

    const code = Math.floor(1000 + Math.random() * 9000);
    user.code = code;
    await user.save();

    await sendEmailResetCode(email, user.username, code);

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await userRepository.update(user._id, { password: hashedPassword });
};

const loginUser = async (data) => {
    const { errors, isValid } = validateLogin(data);
    if (!isValid) {
        const error = new Error('Validation échouée');
        error.statusCode = 400;
        error.details = errors;
        throw error;
    }

    const { email, password } = data;
    // userModel.login() is a custom static method (bcrypt compare) — stays on model
    const user = await userModel.login(email, password);
    const token = createToken(user._id);

    await userRepository.update(user._id, { last_login: new Date() });

    return {
        user: { id: user._id, email: user.email, role: user.role, status: user.status },
        token,
        maxTime,
    };
};

const getConnectedUser = async (id) => {
    if (!id) {
        const error = new Error('Utilisateur introuvable');
        error.statusCode = 404;
        throw error;
    }

    const user = await userRepository.findById(id);
    if (!user) {
        const error = new Error('Utilisateur introuvable');
        error.statusCode = 404;
        throw error;
    }

    return user;
};

const changePassword = async (id, currentPassword, newPassword) => {
    if (!id) {
        const error = new Error('Non authentifié');
        error.statusCode = 401;
        throw error;
    }

    // verifPasswordUser is a custom static method (bcrypt compare) — stays on model
    const change = await userModel.verifPasswordUser(id, currentPassword);
    if (!change) {
        const error = new Error('Mot de passe actuel incorrect');
        error.statusCode = 401;
        throw error;
    }

    const { errors, isValid } = validatePassword(newPassword);
    if (!isValid) {
        const error = new Error('Validation échouée');
        error.statusCode = 400;
        error.details = errors;
        throw error;
    }

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await userRepository.update(id, { password: hashedPassword });
};

const updatePersonnelData = async (id, data, currentPassword) => {
    const { errors, isValid } = validateUserUpdate(data);
    if (!isValid) {
        const error = new Error('Validation échouée');
        error.statusCode = 400;
        error.details = errors;
        throw error;
    }

    if (!id) {
        const error = new Error('Non authentifié');
        error.statusCode = 401;
        throw error;
    }

    const match = await userModel.verifPasswordUser(id, currentPassword);
    if (!match) {
        const error = new Error('Mot de passe actuel incorrect');
        error.statusCode = 401;
        throw error;
    }

    const { username, email, phone } = data;
    const updates = {};
    if (username) updates.username = username;
    if (email) updates.email = email;
    if (phone) updates.phone = phone;

    if (Object.keys(updates).length > 0) {
        await userRepository.update(id, updates);
    }
};

const updateUserStatus = async (id) => {
    const user = await userRepository.findById(id);
    if (!user) {
        const error = new Error('Utilisateur introuvable');
        error.statusCode = 404;
        throw error;
    }
    await userRepository.update(id, { is_active: true });
};

const getAllUsers = async () => {
    return await userRepository.findAll();
};

module.exports = {
    createUser,
    verifyAccounts,
    resendCode,
    forgetPasswordVerifyCode,
    loginUser,
    getConnectedUser,
    changePassword,
    updatePersonnelData,
    updateUserStatus,
    getAllUsers,
};
