const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { requireAuthUser } = require('../middlewares/authMiddelwares');

// Générer une facture depuis une vente
router.post('/generate', requireAuthUser, invoiceController.generateInvoice);

// Obtenir toutes les factures paginées
router.get('/getAllInvoices', requireAuthUser, invoiceController.getAllInvoices);

// Obtenir les données structurées pour générer un PDF côté frontend
router.get('/getInvoiceDataForPdf/:id', requireAuthUser, invoiceController.getInvoiceDataForPdf);

// Changer le statut d'une facture (PENDING, PAID, CANCELLED)
router.put('/updateInvoiceStatus/:id/status', requireAuthUser, invoiceController.updateInvoiceStatus);

module.exports = router;
