const clientRepository = require("../repositories/clientRepository");
const { validateClientRegistration, validateClientUpdate } = require('../validations/ClientValidations');

// Crée un client
const createClient = async (client, companyId) => {
    const validationResult = await validateClientRegistration(client);
    // Correction du bug : était `if (!validationResult)` — doit tester `.isValid`
    if (!validationResult.isValid) {
        const error = new Error('Données client invalides');
        error.statusCode = 400;
        error.details = validationResult.errors;
        throw error;
    }
    return clientRepository.addClient({ ...client, companyId });
};

// Met à jour un client
const updateClient = async (id, data, companyId) => {
    const client = await clientRepository.getClientByID(id, companyId);
    if (!client) {
        const error = new Error('Client introuvable');
        error.statusCode = 404;
        throw error;
    }

    const validationResult = await validateClientUpdate(data);
    if (!validationResult.isValid) {
        const error = new Error('Données client invalides');
        error.statusCode = 400;
        error.details = validationResult.errors;
        throw error;
    }

    return await clientRepository.updateClient(id, data);
};

// Supprime un client
const deleteClient = async (id, companyId) => {
    const client = await clientRepository.getClientByID(id, companyId);
    if (!client) {
        const error = new Error('Client introuvable');
        error.statusCode = 404;
        throw error;
    }
    return await clientRepository.deleteClient(id);
};

// Recherche un client par matricule fiscale
const getClientByMatriculeFiscale = async (mf, companyId) => {
    if (!mf) {
        const error = new Error('Le matricule fiscale est obligatoire');
        error.statusCode = 400;
        throw error;
    }
    const client = await clientRepository.getClientByMatriculeFiscale(mf, companyId);
    if (!client) {
        const error = new Error('Client introuvable');
        error.statusCode = 404;
        throw error;
    }
    return client;
};

// Récupère un client par ID
const getClientByID = async (id, companyId) => {
    const client = await clientRepository.getClientByID(id, companyId);
    if (!client) {
        const error = new Error('Client introuvable');
        error.statusCode = 404;
        throw error;
    }
    return client;
};

// Récupère tous les clients de la compagnie
const getAllClients = async (companyId) => {
    const clients = await clientRepository.getAllClients(companyId);
    if (!clients || clients.length === 0) {
        const error = new Error('Aucun client trouvé');
        error.statusCode = 404;
        throw error;
    }
    return clients;
};

// Recherche des clients par nom
const searchClientsByName = async (name, companyId) => {
    if (!name) {
        const error = new Error('Le paramètre name est requis');
        error.statusCode = 400;
        throw error;
    }
    const clients = await clientRepository.searchClientsByName(name, companyId);
    if (!clients || clients.length === 0) {
        const error = new Error('Aucun client trouvé avec ce nom');
        error.statusCode = 404;
        throw error;
    }
    return clients;
};

module.exports = {
    createClient,
    updateClient,
    deleteClient,
    getClientByMatriculeFiscale,
    getClientByID,
    getAllClients,
    searchClientsByName,
};