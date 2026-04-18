var express = require('express');
var router = express.Router();
const categorieController =require('../Controllers/categorieController')
const {requireAuthUser}= require('../middlewares/authMiddelwares')

router.post('/createCategorie',requireAuthUser, categorieController.createcategory);
router.get('/getAllCategories',requireAuthUser, categorieController.getAllCategories);
router.put('/updateCategorie/:id',requireAuthUser, categorieController.updateCategorie);
router.delete('/deleteCategorie/:id',requireAuthUser, categorieController.deleteCategorie);

module.exports = router;