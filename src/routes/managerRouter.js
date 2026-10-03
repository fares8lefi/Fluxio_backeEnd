const express = require('express');
const router = express.Router();
const managerController = require('../controllers/managerController');
const { requireAuthUser } = require('../middlewares/authMiddelwares');

// Indicateurs de pilotage — un endpoint par bloc, tous scopés à l'entreprise
// de l'utilisateur (companyId issu de la session).
router.get('/kpis', requireAuthUser, managerController.getKpis);
router.get('/sales', requireAuthUser, managerController.getSales);
router.get('/clients', requireAuthUser, managerController.getClients);
router.get('/stock', requireAuthUser, managerController.getStock);
router.get('/activity', requireAuthUser, managerController.getActivity);

module.exports = router;