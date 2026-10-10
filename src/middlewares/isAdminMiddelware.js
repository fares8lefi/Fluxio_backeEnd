const isAdmin = (req, res, next) => {
  try {
    const user = req.session?.user || req.user;

    if (!user) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès refusé : admin requis' });
    }

    if (user.is_active === false) {
      return res.status(403).json({ message: 'Compte admin suspendu' });
    }

    next();
  } catch {
    return res.status(500).json({ message: 'Erreur middleware admin' });
  }
};

module.exports = { isAdmin };
