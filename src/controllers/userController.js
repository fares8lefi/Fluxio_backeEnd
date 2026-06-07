const userService = require('../services/userService');

// POST /api/users/register
module.exports.createUser = async (req, res) => {
    try {
        await userService.createUser(req.body);
        return res.status(200).json({ message: "Un code de vérification a été envoyé à votre email", success: true });
    } catch (error) {
        console.error(error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { errors: error.details }),
        });
    }
};

// POST /api/users/verifyAccount
module.exports.verifyAccounts = async (req, res) => {
    try {
        const { email, code } = req.body;
        await userService.verifyAccounts(email, code);
        return res.status(200).json({ message: "Compte vérifié avec succès", success: true });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

// POST /api/users/resendCode
module.exports.resendCode = async (req, res) => {
    try {
        const { email } = req.body;
        await userService.resendCode(email);
        return res.status(200).json({ message: "Code renvoyé à votre email", success: true });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

// POST /api/users/forgetPassword
module.exports.foorgetPasswordVerifyCode = async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        await userService.forgetPasswordVerifyCode(email, newPassword);
        return res.status(200).json({ message: "Mot de passe modifié avec succès", success: true });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { errors: error.details }),
        });
    }
};

// POST /api/users/login
module.exports.loginUser = async (req, res) => {
    try {
        const result = await userService.loginUser(req.body);

        res.cookie("jwt_login", result.token, {
            httpOnly: true,
            maxAge: result.maxTime * 1000, // maxAge en millisecondes pour Express
        });

        return res.status(200).json({
            success: true,
            user:  result.user,
            token: result.token,
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { errors: error.details }),
        });
    }
};

// GET /api/users/me
// Correction : utilise `req.user?.id` (Prisma) au lieu de `req.session.user?._id` (Mongoose)
module.exports.getConnectedUser = async (req, res) => {
    try {
        const id = req.user?.id || req.session?.user?.id;
        const user = await userService.getConnectedUser(id);
        return res.status(200).json({ success: true, user });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

// POST /api/users/logout
module.exports.logOutUser = async (req, res) => {
    try {
        res.cookie("jwt_login", "", {
            maxAge: 1,
            httpOnly: true,
        });
        return res.status(200).json({ success: true, message: "Déconnecté avec succès" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// PUT /api/users/changePassword
// Correction : utilise `req.user?.id` (Prisma) au lieu de `req.user?._id` (Mongoose)
module.exports.changePassword = async (req, res) => {
    try {
        const { currentPassord, newPassword } = req.body;
        const id = req.user?.id || req.session?.user?.id;

        await userService.changePassword(id, currentPassord, newPassword);
        return res.status(200).json({ success: true, message: "Mot de passe mis à jour avec succès" });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { errors: error.details }),
        });
    }
};

// PUT /api/users/updateProfile
// Correction : utilise `req.user?.id` (Prisma) au lieu de `req.user?._id` (Mongoose)
module.exports.updatePersonnelData = async (req, res) => {
    try {
        const { password, ...data } = req.body;
        const id = req.user?.id || req.session?.user?.id;

        await userService.updatePersonnelData(id, data, password);
        return res.status(200).json({ success: true, message: 'Profil mis à jour avec succès' });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { errors: error.details }),
        });
    }
};

// PATCH /api/users/updateStatus
module.exports.updateUserStatus = async (req, res) => {
    try {
        const id = req.user?.id || req.session?.user?.id;
        await userService.updateUserStatus(id);
        return res.status(200).json({ success: true, message: "Statut utilisateur mis à jour" });
    } catch (error) {
        console.error("error", error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

// GET /api/users/all  (admin seulement)
module.exports.getAllUsers = async (req, res) => {
    try {
        const users = await userService.getAllUsers();
        return res.status(200).json({ success: true, users });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};