/**
 * Protection CSRF : les requêtes d'écriture venant d'un navigateur doivent provenir
 * d'une origine autorisée (FRONTEND_URL). Indispensable si COOKIE_SAMESITE=none, car
 * le navigateur joint alors les cookies d'authentification aux requêtes d'un autre site.
 * Sans en-tête Origin ni Referer (client non navigateur : curl, tests…), on laisse passer.
 */
const { URL } = require('url');

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

const normalize = (url) => String(url).trim().replace(/\/$/, '');

/** Origines du frontend autorisées (liste séparée par des virgules) */
const allowedOrigins = () =>
  (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(normalize).filter(Boolean);

const requestOrigin = (req) => {
  if (req.headers.origin) return normalize(req.headers.origin);
  if (req.headers.referer) {
    try {
      return new URL(req.headers.referer).origin;
    } catch {
      return 'invalid';
    }
  }
  return null;
};

const originCheck = (req, res, next) => {
  if (SAFE_METHODS.includes(req.method)) return next();
  const origin = requestOrigin(req);
  if (origin === null || allowedOrigins().includes(origin)) return next();
  return res.status(403).json({ success: false, message: 'Origine de la requête non autorisée' });
};

module.exports = { originCheck, allowedOrigins };
