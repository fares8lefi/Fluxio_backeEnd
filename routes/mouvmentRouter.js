var express = require('express');
var router = express.Router();
const mouvmentController = require('../Controllers/mouvmentController');
const { requireAuthUser } = require('../middlewares/authMiddelwares');

router.post('/createMouvment',requireAuthUser, mouvmentController.createMouvment);
router.get('/getAllMouvment',requireAuthUser, mouvmentController.getAllMouvment);
 
module.exports = router;