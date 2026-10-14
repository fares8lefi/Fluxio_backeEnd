const express = require('express');
const router = express.Router();
const categorieController = require('../controllers/categorieController');
const { requireAuthUser } = require('../middlewares/authMiddelwares');
const { canWriteStock } = require('../middlewares/companyRole');

router.post('/createCategorie', requireAuthUser, canWriteStock, categorieController.createcategory);
router.get('/getAllCategories', requireAuthUser, categorieController.getAllCategories);
router.get('/searchByName', requireAuthUser, categorieController.searchCategoriesByName);
router.put(
  '/updateCategorie/:id',
  requireAuthUser,
  canWriteStock,
  categorieController.updateCategorie
);
router.delete(
  '/deleteCategorie/:id',
  requireAuthUser,
  canWriteStock,
  categorieController.deleteCategorie
);
// Route paramétrique en dernier
router.get('/getCategorieById/:id', requireAuthUser, categorieController.getCategorieById);

module.exports = router;
