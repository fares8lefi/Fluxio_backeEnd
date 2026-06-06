var express = require('express');
var router = express.Router();
const clientController = require('../controllers/clientController')
const {requireAuthUser}= require('../middlewares/authMiddelwares')

router.post('/createClient',clientController.createClient)
router.put('/updateClient/:id' ,clientController.updateClient)
router.delete('/deleteClient/:id' ,clientController.deleteClient)
router.get("/getAllClients",clientController.getAllClients)
router.get('/getClinetByMatrcuileFiscale/:mf',clientController.getClinetByMatrcuileFiscale)
module.exports = router;