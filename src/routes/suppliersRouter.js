const express = require('express');
const router = express.Router();
const suppliersController = require('../controllers/suppliersController');
const { requireAuthUser } = require('../middlewares/authMiddelwares');

router.post('/addSuppliers',                requireAuthUser, suppliersController.addSuppliers);
router.delete('/deleteSuppliers/:id',       requireAuthUser, suppliersController.deleteSuppliers);
router.put('/updateSuppliers/:id',          requireAuthUser, suppliersController.updateSuppliers);
router.get('/getAllSuppliers',              requireAuthUser, suppliersController.getAllSuppliers);
router.get('/getActiveSuppliers',          requireAuthUser, suppliersController.getActiveSuppliers);
router.patch('/updateSuppliersStatus/:id', requireAuthUser, suppliersController.updateSuppliersStatus);
router.get('/searchSuppliersByName',       requireAuthUser, suppliersController.searchSuppliersByName);
// Route paramétrique en dernier pour éviter les conflits
router.get('/:id',                         requireAuthUser, suppliersController.getSupplierById);

module.exports = router;