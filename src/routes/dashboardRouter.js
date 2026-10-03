const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuthUser } = require('../middlewares/authMiddelwares');

router.get('/summary', requireAuthUser, dashboardController.getSummary);
router.get('/revenue', requireAuthUser, dashboardController.getRevenue);
router.get('/topProducts', requireAuthUser, dashboardController.getTopProducts);
router.get('/stock-health', requireAuthUser, dashboardController.getStockHealth);
router.get('/stock-history', requireAuthUser, dashboardController.getStockHistory);

module.exports = router;
