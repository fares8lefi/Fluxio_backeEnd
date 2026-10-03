const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quoteController');
const { requireAuthUser } = require('../middlewares/authMiddelwares');

router.post('/create', requireAuthUser, quoteController.createQuote);
router.get('/getAll', requireAuthUser, quoteController.getAllQuotes);
router.get('/:id', requireAuthUser, quoteController.getQuoteById);
router.put('/updateStatus/:id', requireAuthUser, quoteController.updateQuoteStatus);

module.exports = router;
