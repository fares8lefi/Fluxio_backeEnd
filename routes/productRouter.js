var express = require('express');
var router = express.Router();
const productController =require('../Controllers/productController')
const { requireAuthUser } = require('../middlewares/authMiddelwares');


//post
router.post('/addProduct', requireAuthUser, productController.addProduct);
//put
router.put('/updateProduct/:id',requireAuthUser, productController.updateProduct);
//delete
router.delete('/deleteProduct/:id',requireAuthUser, productController.deleteProduct);

//get
router.get('/getAllProduct',requireAuthUser, productController.getAllProduct);
router.get('/getProductById/:id',requireAuthUser, productController.getProductById);
router.get('/getProductByFiltres',requireAuthUser, productController.getProductByFiltres);
router.get('/getSumProductByCategorie',requireAuthUser, productController.getSumProductByCategorie);
module.exports = router;