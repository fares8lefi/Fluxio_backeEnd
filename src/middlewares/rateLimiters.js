const rateLimit = require('express-rate-limit');

/**
 * Limiteurs de débit des routes d'authentification (par adresse IP).
 * Complètent la limite de 5 essais par code OTP (userService.checkOtp).
 */
const limiter = (max, message) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    message: { success: false, message },
  });

// Connexion : freine le test de mots de passe
const loginLimiter = limiter(10, 'Trop de tentatives de connexion. Réessayez dans 15 minutes.');

// Codes OTP (vérification de compte, réinitialisation, renvoi d'e-mail)
const otpLimiter = limiter(10, 'Trop de demandes de code. Réessayez dans 15 minutes.');

module.exports = { loginLimiter, otpLimiter };
