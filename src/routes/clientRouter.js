const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { requireAuthUser } = require('../middlewares/authMiddelwares');

// Toutes les routes clients requièrent une authentification
router.post('/createClient', requireAuthUser, clientController.createClient);
router.put('/updateClient/:id',requireAuthUser, clientController.updateClient);
router.delete('/deleteClient/:id',requireAuthUser, clientController.deleteClient);
router.get('/getAllClients',requireAuthUser, clientController.getAllClients);
router.get('/getClientByMatriculeFiscale/:mf',requireAuthUser, clientController.getClientByMatriculeFiscale);
router.get('/searchClientsByName',requireAuthUser, clientController.searchClientsByName);
router.get('/:id', requireAuthUser, clientController.getClientById);

module.exports = router;