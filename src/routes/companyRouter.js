const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { requireAuthUser } = require('../middlewares/authMiddelwares');

// Routes pour la gestion de l'entreprise de l'utilisateur connecté (MVP)
router.get('/my-company', requireAuthUser, companyController.getMyCompany);
router.put('/update', requireAuthUser, companyController.updateMyCompany);

module.exports = router;
