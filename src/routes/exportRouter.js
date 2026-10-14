const express = require('express');
const router = express.Router();
const exportService = require('../services/exportService');
const { requireAuthUser } = require('../middlewares/authMiddelwares');
const { canReadFinance } = require('../middlewares/companyRole');

const currentUser = (req) => (req.session && req.session.user ? req.session.user : req.user);

/** Envoie un CSV en téléchargement */
const sendCsv = (build) => async (req, res) => {
  try {
    const { csv, filename } = await build(currentUser(req).companyId, req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// Exports pour le comptable
router.get('/sales-journal', requireAuthUser, canReadFinance, sendCsv(exportService.salesJournal));
router.get('/vat-summary', requireAuthUser, canReadFinance, sendCsv(exportService.vatSummary));
router.get('/products', requireAuthUser, sendCsv(exportService.products));
router.get('/clients', requireAuthUser, sendCsv(exportService.clients));
router.get('/movements', requireAuthUser, sendCsv(exportService.movements));

module.exports = router;
