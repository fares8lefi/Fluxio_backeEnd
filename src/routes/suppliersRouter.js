const express = require('express');
const router = express.Router();
const suppliersController = require('../controllers/suppliersController');
const { requireAuthUser } = require('../middlewares/authMiddelwares');
const { canWriteStock } = require('../middlewares/companyRole');

//create
router.post('/addSuppliers', requireAuthUser, canWriteStock, suppliersController.addSuppliers);
//delete
router.delete(
  '/deleteSuppliers/:id',
  requireAuthUser,
  canWriteStock,
  suppliersController.deleteSuppliers
);
//update
router.put(
  '/updateSuppliers/:id',
  requireAuthUser,
  canWriteStock,
  suppliersController.updateSuppliers
);
router.patch(
  '/updateSuppliersStatus/:id',
  requireAuthUser,
  canWriteStock,
  suppliersController.updateSuppliersStatus
);
router.patch(
  '/activatedSuppliersStatus/:id',
  requireAuthUser,
  canWriteStock,
  suppliersController.activatedSuppliersStatus
);
//get
router.get('/getAllSupplier', requireAuthUser, suppliersController.getAllSuppliers);
router.get('/getActiveSuppliers', requireAuthUser, suppliersController.getActiveSuppliers);
router.get('/searchSuppliersByName', requireAuthUser, suppliersController.searchSuppliersByName);
router.get('/getSupplierById/:id', requireAuthUser, suppliersController.getSupplierById);

module.exports = router;
