const express = require('express');
const router = express.Router();
const mouvmentController = require('../controllers/mouvmentController');
const { requireAuthUser } = require('../middlewares/authMiddelwares');
const { canWriteStock } = require('../middlewares/companyRole');

router.post('/createMouvment', requireAuthUser, canWriteStock, mouvmentController.createMouvment);
router.get('/getAllMouvment', requireAuthUser, mouvmentController.getAllMouvment);
router.get('/getByClient/:clientId', requireAuthUser, mouvmentController.getMouvmentsByClient);
router.get(
  '/getBySupplier/:supplierId',
  requireAuthUser,
  mouvmentController.getMouvmentsBySupplier
);
router.put('/cancel/:id', requireAuthUser, canWriteStock, mouvmentController.cancelMouvment);
router.post('/adjustments', requireAuthUser, canWriteStock, mouvmentController.adjustStock);
router.get('/:id', requireAuthUser, mouvmentController.getMouvmentById);

module.exports = router;
