// Logique métier des utilisateurs — toutes les opérations Mongoose remplacées par le repository Prisma.
const userRepository = require('../repositories/userRepository');
const companyRepository = require('../repositories/companyRepository');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendEmailVerificationCode, sendEmailResetCode } = require('./SendEmail');
const { validateUserRegistration, validateUserUpdate, validatePassword, validateLogin } = require('../validations/UserValidations');

const maxTime = 240 * 60 * 60;

const createAccessToken = (id) => {
    const expiry = process.env.ACCESS_TOKEN_EXPIRY || "15m";
    return jwt.sign({ id }, process.env.net_Secret, { expiresIn: expiry });
};

const createRefreshToken = (id) => {
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET || (process.env.net_Secret + "_refresh");
    const expiry = process.env.REFRESH_TOKEN_EXPIRY || "10d";
    return jwt.sign({ id }, refreshSecret, { expiresIn: expiry });
};

const createUser = async (data) => {
    const { errors, isValid } = validateUserRegistration(data);
    if (!isValid) {
        const error = new Error('Validation échouée');
        error.statusCode = 400;
        error.details = errors;
        throw error;
    }

    const { username, password, phone, email, company_name } = data;
    const code = Math.floor(1000 + Math.random() * 9000);
    // Le code OTP expire dans 10 minutes
    const code_expires_at = new Date(Date.now() + 10 * 60 * 1000);

    const company = await companyRepository.create({ name: company_name });

    await Promise.all([
        userRepository.create({ username, email, password, phone, code, code_expires_at, is_active: false, companyId: company.id }),
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

    // Vérifier que le code OTP n'a pas expiré
    if (user.code_expires_at && new Date() > new Date(user.code_expires_at)) {
        const error = new Error('Code expiré. Veuillez en demander un nouveau.');
        error.statusCode = 400;
        throw error;
    }

    await userRepository.update(user.id, { is_active: true, code: null, code_expires_at: null });
};

const resendCode = async (email) => {
    const user = await userRepository.findOneByEmailWithPassword(email);
    if (!user) {
        const error = new Error('Utilisateur introuvable');
        error.statusCode = 404;
        throw error;
    }

    const code = Math.floor(1000 + Math.random() * 9000);
    const code_expires_at = new Date(Date.now() + 10 * 60 * 1000);
    await userRepository.update(user.id, { code, code_expires_at });

    await sendEmailVerificationCode(email, user.username, code);
};

/**
 * Étape 1 — Initier la réinitialisation du mot de passe :
 * Génère un code OTP et l'envoie par email.
 */
const forgetPassword = async (email) => {
    const user = await userRepository.findOneByEmailWithPassword(email);
    if (!user) {
        // Par sécurité on ne révèle pas si l'email existe ou non
        return;
    }

    const code = Math.floor(1000 + Math.random() * 9000);
    const code_expires_at = new Date(Date.now() + 10 * 60 * 1000);
    await userRepository.update(user.id, { code, code_expires_at });

    await sendEmailResetCode(email, user.username, code);
};

/**
 * Étape 2 — Vérifier le code OTP et définir le nouveau mot de passe.
 */
const forgetPasswordVerifyCode = async (email, code, newPassword) => {
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

    if (String(user.code) !== String(code)) {
        const error = new Error('Code invalide');
        error.statusCode = 400;
        throw error;
    }

    if (user.code_expires_at && new Date() > new Date(user.code_expires_at)) {
        const error = new Error('Code expiré. Veuillez en demander un nouveau.');
        error.statusCode = 400;
        throw error;
    }

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    // Invalider le code après utilisation
    await userRepository.update(user.id, {
        password: hashedPassword,
        code: null,
        code_expires_at: null,
    });
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

    const accessToken = createAccessToken(user.id);
    const refreshToken = createRefreshToken(user.id);

    // Save refresh token in DB along with last login time
    await userRepository.update(user.id, { 
        last_login: new Date(),
        refreshToken: refreshToken
    });

    return {
        user: { id: user.id, email: user.email, role: user.role, status: user.is_active },
        token: accessToken, // Backward compatibility
        accessToken,
        refreshToken,
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

const refreshAccessToken = async (refreshToken) => {
    if (!refreshToken) {
        const error = new Error('Refresh token requis');
        error.statusCode = 401;
        throw error;
    }

    try {
        const refreshSecret = process.env.REFRESH_TOKEN_SECRET || (process.env.net_Secret + "_refresh");
        const decoded = jwt.verify(refreshToken, refreshSecret);
        
        // Find user by ID and check their stored refresh token
        const user = await userRepository.findByIdWithPassword(decoded.id);
        if (!user) {
            const error = new Error('Utilisateur introuvable');
            error.statusCode = 401;
            throw error;
        }

        if (!user.is_active) {
            const error = new Error('Compte non activé');
            error.statusCode = 403;
            throw error;
        }

        if (user.refreshToken !== refreshToken) {
            const error = new Error('Refresh token invalide ou expiré');
            error.statusCode = 401;
            throw error;
        }

        // Generate new tokens (token rotation)
        const newAccessToken = createAccessToken(user.id);
        const newRefreshToken = createRefreshToken(user.id);

        // Update database with the new refresh token
        await userRepository.update(user.id, { refreshToken: newRefreshToken });

        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            user: { id: user.id, email: user.email, role: user.role, status: user.is_active }
        };
    } catch (err) {
        console.error('Refresh token error:', err);
        const error = new Error('Refresh token invalide ou expiré');
        error.statusCode = 401;
        throw error;
    }
};

const logoutUser = async (id) => {
    if (id) {
        await userRepository.update(id, { refreshToken: null });
    }
};

const deleteUser = async (targetId, requesterId) => {
    if (targetId === requesterId) {
        const error = new Error('Vous ne pouvez pas supprimer votre propre compte');
        error.statusCode = 403;
        throw error;
    }
    const user = await userRepository.findById(targetId);
    if (!user) {
        const error = new Error('Utilisateur introuvable');
        error.statusCode = 404;
        throw error;
    }
    await userRepository.deleteById(targetId);
};

module.exports = {
    createUser,
    verifyAccounts,
    resendCode,
    forgetPassword,
    forgetPasswordVerifyCode,
    loginUser,
    getConnectedUser,
    changePassword,
    updatePersonnelData,
    updateUserStatus,
    getAllUsers,
    deleteUser,
    createAccessToken,
    createRefreshToken,
    refreshAccessToken,
    logoutUser,
};
