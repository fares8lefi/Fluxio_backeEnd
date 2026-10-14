const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quoteController');
const { requireAuthUser } = require('../middlewares/authMiddelwares');
const { canWriteBilling } = require('../middlewares/companyRole');

router.post('/create', requireAuthUser, canWriteBilling, quoteController.createQuote);
router.get('/getAll', requireAuthUser, quoteController.getAllQuotes);
router.post('/:id/convert', requireAuthUser, canWriteBilling, quoteController.convertQuote);
router.get('/:id', requireAuthUser, quoteController.getQuoteById);
router.put(
  '/updateStatus/:id',
  requireAuthUser,
  canWriteBilling,
  quoteController.updateQuoteStatus
);

module.exports = router;
