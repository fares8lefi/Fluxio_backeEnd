// Logique métier des utilisateurs — toutes les opérations Mongoose remplacées par le repository Prisma.
const userRepository = require('../repositories/userRepository');
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
    // findOneByEmail returns user without password — we need the full user with code
    const user = await userRepository.findOneByEmailWithPassword(email);
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

    await userRepository.update(user.id, { is_active: true, code: null });
};

const resendCode = async (email) => {
    const user = await userRepository.findOneByEmailWithPassword(email);
    if (!user) {
        const error = new Error('Utilisateur introuvable');
        error.statusCode = 404;
        throw error;
    }

    const code = Math.floor(1000 + Math.random() * 9000);
    await userRepository.update(user.id, { code });

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

    const user = await userRepository.findOneByEmailWithPassword(email);
    if (!user) {
        const error = new Error('Utilisateur introuvable');
        error.statusCode = 404;
        throw error;
    }

    const code = Math.floor(1000 + Math.random() * 9000);
    await userRepository.update(user.id, { code });

    await sendEmailResetCode(email, user.username, code);

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await userRepository.update(user.id, { password: hashedPassword });
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

    // Get full user including password for bcrypt compare
    const user = await userRepository.findOneByEmailWithPassword(email);
    if (!user) throw new Error('email not found');

    const auth = await bcrypt.compare(password, user.password);
    if (!auth) throw new Error('password invalid');

    const token = createToken(user.id);
    await userRepository.update(user.id, { last_login: new Date() });

    return {
        user: { id: user.id, email: user.email, role: user.role, status: user.is_active },
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

    const isValid = await userRepository.verifPasswordUser(id, currentPassword);
    if (!isValid) {
        const error = new Error('Mot de passe actuel incorrect');
        error.statusCode = 401;
        throw error;
    }

    const { errors, isValid: passwordValid } = validatePassword(newPassword);
    if (!passwordValid) {
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

    const match = await userRepository.verifPasswordUser(id, currentPassword);
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
