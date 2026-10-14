/**
 * Options communes des cookies d'authentification.
 * En production : `secure` (HTTPS uniquement). `sameSite` vaut `lax` par défaut ;
 * mettre COOKIE_SAMESITE=none si le frontend est servi depuis un autre site
 * que l'API (le navigateur exige alors `secure`).
 */
const isProduction = () => process.env.NODE_ENV === 'production';

const authCookieOptions = (maxAge) => {
  const sameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  return {
    httpOnly: true,
    maxAge,
    sameSite,
    secure: isProduction() || sameSite === 'none',
  };
};

module.exports = { authCookieOptions };
