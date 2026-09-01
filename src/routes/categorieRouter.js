const express = require('express');
const  router = express.Router();
const categorieController = require('../controllers/categorieController')
const {requireAuthUser}= require('../middlewares/authMiddelwares')

router.post('/createCategorie',requireAuthUser, categorieController.createcategory);
router.get('/getAllCategories',requireAuthUser, categorieController.getAllCategories);
router.get('/searchByName',requireAuthUser, categorieController.searchCategoriesByName);
router.put('/updateCategorie/:id',requireAuthUser, categorieController.updateCategorie);
router.delete('/deleteCategorie/:id',requireAuthUser, categorieController.deleteCategorie);
// Route paramétrique en dernier
router.get('/:id',requireAuthUser, categorieController.getCategorieById);

module.exports = router;