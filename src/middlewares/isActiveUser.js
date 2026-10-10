/**
 * Middleware : lecture seule pour les utilisateurs dont le compte est suspendu (is_active = false).
 * Les admins ne sont pas concernés par cette restriction.
 *
 * GET requests → toujours autorisées
 * POST / PUT / PATCH / DELETE → bloquées si is_active = false
 */
const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

const isActiveUser = (req, res, next) => {
  const user = req.session?.user || req.user;

  // Si pas d'utilisateur authentifié, on laisse passer (d'autres middlewares gèrent ça)
  if (!user) return next();

  // Les admins ne sont jamais limités en lecture seule
  if (user.role === 'admin') return next();

  // Si le compte est suspendu ET que c'est une requête d'écriture → bloquer
  if (user.is_active === false && WRITE_METHODS.includes(req.method)) {
    return res.status(403).json({
      success: false,
      message: 'Compte suspendu : accès en lecture seule. Contactez votre administrateur.',
    });
  }

  next();
};

module.exports = { isActiveUser };
