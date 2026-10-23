/**
 * Protection CSRF : les requêtes d'écriture venant d'un navigateur doivent provenir
 * d'une origine autorisée (FRONTEND_URL). Indispensable si COOKIE_SAMESITE=none, car
 * le navigateur joint alors les cookies d'authentification aux requêtes d'un autre site.
 * Sans en-tête Origin ni Referer (client non navigateur : curl, tests…), on laisse passer.
 */
const { URL } = require('url');

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// Tolère la casse et un « / » ou « . » final (ex. « https://app.vercel.app. »)
const normalize = (url) =>
  String(url)
    .trim()
    .toLowerCase()
    .replace(/[/.]+$/, '');

/** Origines du frontend autorisées (liste séparée par des virgules) */
const allowedOrigins = () =>
  (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(normalize).filter(Boolean);

const escapeRegex = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

// « * » remplace un seul segment de nom d'hôte (lettres, chiffres, tirets, sans point),
// ex. https://fluxio-*-lafifares-5848s-projects.vercel.app pour les aperçus Vercel
const matches = (pattern, origin) =>
  pattern.includes('*')
    ? new RegExp(`^${escapeRegex(pattern).replace(/\*/g, '[a-z0-9-]+')}$`).test(origin)
    : pattern === origin;

/** Vrai si l'origine (en-tête Origin) figure dans FRONTEND_URL */
const isAllowedOrigin = (origin) => {
  const normalized = normalize(origin);
  return allowedOrigins().some((pattern) => matches(pattern, normalized));
};

const requestOrigin = (req) => {
  if (req.headers.origin) return req.headers.origin;
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
  if (origin === null || isAllowedOrigin(origin)) return next();
  return res.status(403).json({ success: false, message: 'Origine de la requête non autorisée' });
};

module.exports = { originCheck, allowedOrigins, isAllowedOrigin };
