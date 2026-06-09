const  express = require('express');
const  router = express.Router();
const productController = require('../controllers/productController')
const { requireAuthUser } = require('../middlewares/authMiddelwares');


//post
router.post('/addProduct',requireAuthUser, productController.addProduct);

//put
router.put('/updateProduct/:id',requireAuthUser, productController.updateProduct);
//delete
router.delete('/deleteProduct/:id',requireAuthUser, productController.deleteProduct);

//get
router.get('/getAllProduct',requireAuthUser, productController.getAllProduct);
router.get('/getProductById/:id',requireAuthUser, productController.getProductById);
router.get('/getProductByFiltres',requireAuthUser, productController.getProductByFiltres); 
router.get('/getProductsBySupplier',requireAuthUser, productController.getSuppliersByProduct);
router.get('/getProductsByCategories',requireAuthUser, productController.getProductsByCategories);
router.get('/getSumProductByCategorie',requireAuthUser, productController.getSumProductByCategorie);
router.get('/getProductsBelowStockMin',requireAuthUser, productController.getProductsBelowStockMin);
router.get('/getLowStockDashboard',requireAuthUser,productController.getLowStockDashboard)
router.get('/getOutOfStockProducts',requireAuthUser,productController.getOutOfStockProducts)

module.exports = router;
