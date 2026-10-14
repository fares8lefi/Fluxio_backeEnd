const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const paymentController = require('../controllers/paymentController');
const { requireAuthUser } = require('../middlewares/authMiddelwares');
const { canWriteBilling } = require('../middlewares/companyRole');

// Lister les mouvements OUT facturables (avec les informations manquantes à compléter)
router.get('/getMovementsForInvoice', requireAuthUser, invoiceController.getMovementsForInvoice);

// Générer une facture depuis une vente
router.post('/generate', requireAuthUser, canWriteBilling, invoiceController.generateInvoice);

// Obtenir toutes les factures paginées
router.get('/getAllInvoices', requireAuthUser, invoiceController.getAllInvoices);

// Obtenir les données structurées pour générer un PDF côté frontend
router.get('/getInvoiceDataForPdf/:id', requireAuthUser, invoiceController.getInvoiceDataForPdf);

// Changer le statut d'une facture (PENDING, PAID, CANCELLED)
router.put(
  '/updateInvoiceStatus/:id/status',
  requireAuthUser,
  canWriteBilling,
  invoiceController.updateInvoiceStatus
);

// Émettre un avoir sur une facture
router.post(
  '/credit-note/:id',
  requireAuthUser,
  canWriteBilling,
  invoiceController.createCreditNote
);

// Règlements (totaux ou partiels)
router.get('/:id/payments', requireAuthUser, paymentController.listPayments);
router.post('/:id/payments', requireAuthUser, canWriteBilling, paymentController.addPayment);
router.delete(
  '/payments/:paymentId',
  requireAuthUser,
  canWriteBilling,
  paymentController.deletePayment
);

module.exports = router;
