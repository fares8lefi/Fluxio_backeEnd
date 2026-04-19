var express = require('express');
var router = express.Router();
const productController =require('../Controllers/productController')
const { requireAuthUser } = require('../middlewares/authMiddelwares');


router.post('/addProduct', requireAuthUser, productController.addProduct);
router.put('/updateProduct/:id',requireAuthUser, productController.updateProduct);
router.delete('/deleteProduct/:id',requireAuthUser, productController.deleteProduct);
router.get('/getAllProduct',requireAuthUser, productController.getAllProduct);
router.get('/getProductById/:id',requireAuthUser, productController.getProductById);

module.exports = router;