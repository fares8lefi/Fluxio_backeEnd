var express = require('express');
var router = express.Router();

const suppliersController=require('../Controllers/suppliersController')
const {requireAuthUser}= require("../middlewares/authMiddelwares");



router.post('/addSuppliers',requireAuthUser, suppliersController.addSuppliers);
router.delete('/deleteSuppliers/:id',requireAuthUser, suppliersController.deleteSuppliers);
router.put('/updateSuppliers/:id',requireAuthUser, suppliersController.updateSuppliers);
router.get('/getAllSuppliers',requireAuthUser, suppliersController.getAllSuppliers);
router.get('/getActiveSuppliers', suppliersController.getActiveSuppliers);
router.patch('/updateSuppliersStatus/:id',requireAuthUser, suppliersController.updateSuppliersStatus);
router.get('/searchSuppliersByName', requireAuthUser, suppliersController.searchSuppliersByName);

module.exports = router;