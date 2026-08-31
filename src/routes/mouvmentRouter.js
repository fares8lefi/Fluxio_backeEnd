const express = require('express');
const  router = express.Router();
const mouvmentController = require('../controllers/mouvmentController');
const { requireAuthUser } = require('../middlewares/authMiddelwares');

router.post('/createMouvment',requireAuthUser, mouvmentController.createMouvment);
router.get('/getAllMouvment',requireAuthUser, mouvmentController.getAllMouvment);
router.get('/getByClient/:clientId', requireAuthUser, mouvmentController.getMouvmentsByClient);
router.get('/getBySupplier/:supplierId', requireAuthUser, mouvmentController.getMouvmentsBySupplier);
router.put('/cancel/:id', requireAuthUser, mouvmentController.cancelMouvment);
router.get('/:id', requireAuthUser, mouvmentController.getMouvmentById);
 
module.exports = router;