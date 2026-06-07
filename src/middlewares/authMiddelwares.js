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