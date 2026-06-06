var express = require('express');
var router = express.Router();
const clientController = require('../controllers/clientController')
const {requireAuthUser}= require('../middlewares/authMiddelwares')

router.post('/createClient',clientController.createClient)
router.put('/updateClient/:id' ,clientController.updateClient)
router.delete('/deleteClient/:id' ,clientController.deleteClient)
router.get("/getAllClients",clientController.getAllClients)
router.get('/getClientByMatriculeFiscale/:mf',clientController.getClientByMatriculeFiscale)
router.get('/searchClientsByName',clientController.searchClientsByName)
module.exports = router;