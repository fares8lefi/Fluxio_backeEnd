const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAuthUser } = require('../middlewares/authMiddelwares');
const { isAdmin } = require('../middlewares/isAdminMiddelware');

// Toutes les routes admin requièrent : être authentifié + avoir le rôle admin
router.use(requireAuthUser, isAdmin);

// ─── Dashboard plateforme ───────────────────────────────────────────────────
router.get('/stats', adminController.getPlatformStats);

// ─── Gestion des entreprises ────────────────────────────────────────────────
// Liste paginée : GET /api/admin/companies?page=1&limit=20&search=acme
router.get('/companies', adminController.getAllCompanies);

// Détail d'une entreprise (avec ses users et compteurs)
router.get('/companies/:id', adminController.getCompanyDetails);

// Modifier données générales uniquement (name, address, phone, matriculeFiscale)
router.put('/companies/:id', adminController.updateCompanyGeneralInfo);

// Activer / Suspendre une entreprise : { "is_active": false }
router.patch('/companies/:id/status', adminController.toggleCompanyStatus);

// ─── Gestion des utilisateurs ───────────────────────────────────────────────
// Activer / Suspendre un utilisateur : { "is_active": false }
router.patch('/users/:id/status', adminController.toggleUserStatus);

module.exports = router;
