const express = require('express');
const router = express.Router();
const suppliersController = require('../controllers/suppliersController');
const { requireAuthUser } = require('../middlewares/authMiddelwares');

//create
router.post('/addSuppliers', requireAuthUser, suppliersController.addSuppliers);
//delete
router.delete('/deleteSuppliers/:id', requireAuthUser, suppliersController.deleteSuppliers);
//update
router.put('/updateSuppliers/:id', requireAuthUser, suppliersController.updateSuppliers);
router.patch(
  '/updateSuppliersStatus/:id',
  requireAuthUser,
  suppliersController.updateSuppliersStatus
);
router.patch(
  '/activatedSuppliersStatus/:id',
  requireAuthUser,
  suppliersController.activatedSuppliersStatus
);
//get
router.get('/getAllSuppliers', requireAuthUser, suppliersController.getAllSuppliers);
router.get('/getActiveSuppliers', requireAuthUser, suppliersController.getActiveSuppliers);
router.get('/searchSuppliersByName', requireAuthUser, suppliersController.searchSuppliersByName);
router.get('/getSupplierById/:id', requireAuthUser, suppliersController.getSupplierById);

module.exports = router;
