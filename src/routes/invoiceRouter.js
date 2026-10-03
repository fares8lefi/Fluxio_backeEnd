const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { requireAuthUser } = require('../middlewares/authMiddelwares');

// Lister les mouvements OUT facturables (avec les informations manquantes à compléter)
router.get(
  '/getMovementsForInvoice',
  requireAuthUser,
  invoiceController.getMovementsForInvoice
);

// Générer une facture depuis une vente
router.post('/generate', requireAuthUser, invoiceController.generateInvoice);

// Obtenir toutes les factures paginées
router.get('/getAllInvoices', requireAuthUser, invoiceController.getAllInvoices);

// Obtenir les données structurées pour générer un PDF côté frontend
router.get('/getInvoiceDataForPdf/:id', requireAuthUser, invoiceController.getInvoiceDataForPdf);

// Changer le statut d'une facture (PENDING, PAID, CANCELLED)
router.put(
  '/updateInvoiceStatus/:id/status',
  requireAuthUser,
  invoiceController.updateInvoiceStatus
);

// Émettre un avoir sur une facture
router.post(
  '/credit-note/:id',
  requireAuthUser,
  invoiceController.createCreditNote
);

module.exports = router;
