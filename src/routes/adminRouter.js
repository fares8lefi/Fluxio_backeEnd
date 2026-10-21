const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAuthUser } = require('../middlewares/authMiddelwares');
const { isAdmin } = require('../middlewares/isAdminMiddelware');
const adminRepository = require('../repositories/adminRepository');

// Premier admin : tant qu'aucun admin n'existe, la création est ouverte sans token.
// Dès qu'un admin existe, la route exige à nouveau d'être authentifié en tant qu'admin.
const firstAdminOrAdmin = async (req, res, next) => {
  try {
    if ((await adminRepository.countAdmins()) === 0) return next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
  return requireAuthUser(req, res, () => isAdmin(req, res, next));
};

// ─── Gestion des administrateurs ────────────────────────────────────────────
// Créer un admin : { "username", "email", "password", "phone"? }
router.post('/admins', firstAdminOrAdmin, adminController.createAdmin);

// Toutes les autres routes admin requièrent : être authentifié + avoir le rôle admin
router.use(requireAuthUser, isAdmin);

// ─── Dashboard plateforme ───────────────────────────────────────────────────
router.get('/stats', adminController.getPlatformStats);

// ─── Indicateurs (KPI) de la plateforme ─────────────────────────────────────
// Période commune : ?period=month|30d|prev_month|year|custom (&startDate&endDate)
router.get('/kpis/overview', adminController.getKpiOverview);
router.get('/kpis/trend', adminController.getKpiTrend);
router.get('/kpis/top-companies', adminController.getKpiTopCompanies);
router.get('/kpis/health', adminController.getKpiHealth);

// ─── Gestion des entreprises ────────────────────────────────────────────────
// Liste paginée : GET /api/admin/companies?page=1&limit=20&search=acme
router.get('/companies', adminController.getAllCompanies);

// Détail d'une entreprise (avec ses users et compteurs)
router.get('/companies/:id', adminController.getCompanyDetails);

// KPI d'une entreprise (vue « Pilotage » côté admin)
router.get('/companies/:id/kpis', adminController.getCompanyKpis);

// Modifier données générales uniquement (name, address, phone, matriculeFiscale)
router.put('/companies/:id', adminController.updateCompanyGeneralInfo);

// Activer / Suspendre une entreprise : { "is_active": false }
router.patch('/companies/:id/status', adminController.toggleCompanyStatus);

// ─── Gestion des utilisateurs ───────────────────────────────────────────────
// Activer / Suspendre un utilisateur : { "is_active": false }
router.patch('/users/:id/status', adminController.toggleUserStatus);

module.exports = router;
