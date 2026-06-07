const express = require('express');
const  router = express.Router();
const mouvmentController = require('../controllers/mouvmentController');
const { requireAuthUser } = require('../middlewares/authMiddelwares');

router.post('/createMouvment',requireAuthUser, mouvmentController.createMouvment);
router.get('/getAllMouvment',requireAuthUser, mouvmentController.getAllMouvment);
 
module.exports = router;