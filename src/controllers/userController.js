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

// POST /api/users/forgetPassword — Étape 1 : envoyer le code OTP de réinitialisation
module.exports.forgetPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: "L'email est requis" });
        }
        await userService.forgetPassword(email);
        // Réponse générique pour ne pas révéler si l'email existe
        return res.status(200).json({
            success: true,
            message: "Si cet email est enregistré, un code de réinitialisation a été envoyé.",
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

// PUT /api/users/foorgetPasswordVerifyCode — Étape 2 : vérifier le code et changer le mot de passe
module.exports.foorgetPasswordVerifyCode = async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        await userService.forgetPasswordVerifyCode(email, code, newPassword);
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

        // Access Token: 15 minutes
        res.cookie("jwt_login", result.accessToken, {
            httpOnly: true,
            maxAge: 15 * 60 * 1000,
        });

        // Refresh Token: 10 days
        res.cookie("jwt_refresh", result.refreshToken, {
            httpOnly: true,
            maxAge: result.maxTime * 1000,
        });

        return res.status(200).json({
            success: true,
            user:  result.user,
            token: result.accessToken, // Backward compatibility
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
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
module.exports.getConnectedUser = async function (req,res){
    try {
        const userId = req.query.id; 
        const user = await userService.getConnectedUser(userId);
        res.status(200).json({ success: true, user: user });
    } catch (error) {
        console.error(error);
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({ success: false, message: error.message });
    }
}

module.exports.getMe = async function (req, res) {
    try {
        const user = (req.session && req.session.user) ? req.session.user : req.user;
        res.status(200).json({ success: true, user: user });
    } catch (error) {
        console.error(error);
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({ success: false, message: error.message });
    }
};

// POST /api/users/logout
module.exports.logOutUser = async (req, res) => {
    try {
        const id = req.user?.id || req.session?.user?.id;
        if (id) {
            await userService.logoutUser(id);
        }
        res.cookie("jwt_login", "", {
            maxAge: 1,
            httpOnly: true,
        });
        res.cookie("jwt_refresh", "", {
            maxAge: 1,
            httpOnly: true,
        });
        return res.status(200).json({ success: true, message: "Déconnecté avec succès" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/users/refreshToken
module.exports.refreshToken = async (req, res) => {
    try {
        const tokenFromCookie = req.cookies?.jwt_refresh;
        const tokenFromBody   = req.body?.refreshToken;
        const authHeader      = req.headers?.authorization || req.headers?.x_refresh_token;
        const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

        const refreshToken = tokenFromCookie || tokenFromBody || tokenFromHeader;

        if (!refreshToken) {
            return res.status(401).json({ success: false, error: 'Refresh token manquant' });
        }

        const result = await userService.refreshAccessToken(refreshToken);

        // Set access token cookie
        res.cookie("jwt_login", result.accessToken, {
            httpOnly: true,
            maxAge: 15 * 60 * 1000,
        });

        // Set refresh token cookie (rotated refresh token)
        res.cookie("jwt_refresh", result.refreshToken, {
            httpOnly: true,
            maxAge: 10 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({
            success: true,
            user: result.user,
            token: result.accessToken, // Backward compatibility
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
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

// DELETE /api/users/:id  (admin seulement)
module.exports.deleteUser = async (req, res) => {
    try {
        const requesterId = req.user?.id || req.session?.user?.id;
        await userService.deleteUser(req.params.id, requesterId);
        return res.status(200).json({ success: true, message: 'Utilisateur supprimé avec succès' });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};