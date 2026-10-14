const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { requireAuthUser } = require('../middlewares/authMiddelwares');
const { canWriteStock } = require('../middlewares/companyRole');

//post
router.post('/addProduct', requireAuthUser, canWriteStock, productController.addProduct);

//put
router.put('/updateProduct/:id', requireAuthUser, canWriteStock, productController.updateProduct);
//delete
router.delete(
  '/deleteProduct/:id',
  requireAuthUser,
  canWriteStock,
  productController.deleteProduct
);

//get
router.get('/getAllProducts', requireAuthUser, productController.getAllProduct);
router.get('/getProductById/:id', requireAuthUser, productController.getProductById);
router.get('/getProductByFiltres', requireAuthUser, productController.getProductByFiltres);
router.get('/getProductsBySupplier', requireAuthUser, productController.getSuppliersByProduct);
router.get('/getProductsByCategories', requireAuthUser, productController.getProductsByCategories);
router.get(
  '/getSumProductByCategorie',
  requireAuthUser,
  productController.getSumProductByCategorie
);
router.get(
  '/getProductsBelowStockMin',
  requireAuthUser,
  productController.getProductsBelowStockMin
);
router.get('/getLowStockDashboard', requireAuthUser, productController.getLowStockDashboard);
router.get('/getOutOfStockProducts', requireAuthUser, productController.getOutOfStockProducts);

module.exports = router;
