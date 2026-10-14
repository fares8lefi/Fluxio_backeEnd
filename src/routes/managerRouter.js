const express = require('express');
const router = express.Router();
const managerController = require('../controllers/managerController');
const { requireAuthUser } = require('../middlewares/authMiddelwares');
const { canReadFinance } = require('../middlewares/companyRole');

// Indicateurs de pilotage — un endpoint par bloc, tous scopés à l'entreprise
// de l'utilisateur (companyId issu de la session).
router.get('/kpis', requireAuthUser, canReadFinance, managerController.getKpis);
router.get('/sales', requireAuthUser, canReadFinance, managerController.getSales);
router.get('/clients', requireAuthUser, canReadFinance, managerController.getClients);
router.get('/stock', requireAuthUser, canReadFinance, managerController.getStock);
router.get('/activity', requireAuthUser, canReadFinance, managerController.getActivity);

module.exports = router;
