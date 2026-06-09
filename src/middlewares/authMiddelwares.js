const jwt = require("jsonwebtoken");
const userRepository = require("../repositories/userRepository");

/**
 * Middleware d'authentification JWT.
 * Lit le token depuis le cookie `jwt_login`, le header Authorization,
 * ou le body de la requête. Stocke l'utilisateur authentifié dans `req.user`.
 */
const requireAuthUser = (req, res, next) => {
    const tokenFromCookie  = req.cookies?.jwt_login;
    const authHeader       = req.headers?.authorization;
    const tokenFromHeader  = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    const tokenFromBody    = req.body?.token;

    const token = tokenFromCookie || tokenFromHeader || tokenFromBody;

    if (!token) {
        return res.status(401).json({ success: false, error: 'Authentification requise — aucun token fourni' });
    }

    jwt.verify(token, process.env.net_Secret, async (err, decodedToken) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                const refreshCookie = req.cookies?.jwt_refresh;
                const refreshHeader = req.headers?.['x-refresh-token'] || req.headers?.authorization;
                const refreshHeaderToken = refreshHeader?.startsWith('Bearer ') ? refreshHeader.split(' ')[1] : refreshHeader;
                const refreshBody   = req.body?.refreshToken;

                const refreshToken = refreshCookie || refreshBody || refreshHeaderToken;

                if (refreshToken) {
                    try {
                        const userService = require("../services/userService");
                        const refreshResult = await userService.refreshAccessToken(refreshToken);

                        // Set cookies for the new tokens
                        res.cookie("jwt_login", refreshResult.accessToken, {
                            httpOnly: true,
                            maxAge: 15 * 60 * 1000,
                        });
                        res.cookie("jwt_refresh", refreshResult.refreshToken, {
                            httpOnly: true,
                            maxAge: 10 * 24 * 60 * 60 * 1000,
                        });

                        const foundUser = await userRepository.findById(refreshResult.user.id);
                        if (!foundUser) {
                            return res.status(401).json({ success: false, error: 'Utilisateur introuvable' });
                        }
                        if (!foundUser.is_active) {
                            return res.status(403).json({ success: false, error: 'Compte non activé' });
                        }

                        // Inform the client that token was refreshed
                        res.setHeader("X-Token-Refreshed", "true");

                        req.user = foundUser;
                        if (req.session) {
                            req.session.user = foundUser;
                        }

                        return next();
                    } catch (refreshErr) {
                        console.error('Auto-refresh error:', refreshErr);
                        return res.status(401).json({ success: false, error: 'Token expiré — veuillez vous reconnecter' });
                    }
                }
                return res.status(401).json({ success: false, error: 'Token expiré — veuillez vous reconnecter' });
            }
            return res.status(401).json({ success: false, error: 'Token invalide' });
        }

        try {
            const foundUser = await userRepository.findById(decodedToken.id);
            if (!foundUser) {
                return res.status(401).json({ success: false, error: 'Utilisateur introuvable' });
            }
            if (!foundUser.is_active) {
                return res.status(403).json({ success: false, error: 'Compte non activé' });
            }

            // Toujours stocker dans req.user (source unique de vérité)
            req.user = foundUser;
            // Compatibilité avec l'ancien code qui lit req.session.user
            if (req.session) {
                req.session.user = foundUser;
            }

            return next();
        } catch (dbError) {
            console.error('Auth middleware DB error:', dbError);
            return res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
        }
    });
};

module.exports = { requireAuthUser };