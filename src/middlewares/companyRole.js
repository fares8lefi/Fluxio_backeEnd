/**
 * Contrôle du rôle dans l'entreprise (CompanyRole) — à placer après requireAuthUser.
 * OWNER : tout. STOCK : produits, mouvements, inventaire. ACCOUNTANT : facturation,
 * règlements, exports ; le stock reste en lecture. Les admins plateforme passent toujours.
 */
const ROLE_GROUPS = {
  STOCK_WRITE: ['OWNER', 'STOCK'],
  BILLING_WRITE: ['OWNER', 'ACCOUNTANT'],
  FINANCE_READ: ['OWNER', 'ACCOUNTANT'],
  OWNER_ONLY: ['OWNER'],
};

const requireCompanyRole = (allowed) => (req, res, next) => {
  const user = req.user || req.session?.user;
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentification requise' });
  }
  if (user.role === 'admin' || allowed.includes(user.company_role || 'OWNER')) return next();
  return res.status(403).json({
    success: false,
    message: "Votre rôle dans l'entreprise ne permet pas cette action.",
  });
};

module.exports = {
  requireCompanyRole,
  canWriteStock: requireCompanyRole(ROLE_GROUPS.STOCK_WRITE),
  canWriteBilling: requireCompanyRole(ROLE_GROUPS.BILLING_WRITE),
  canReadFinance: requireCompanyRole(ROLE_GROUPS.FINANCE_READ),
  ownerOnly: requireCompanyRole(ROLE_GROUPS.OWNER_ONLY),
  ROLE_GROUPS,
};
