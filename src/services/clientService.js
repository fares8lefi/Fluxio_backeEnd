const clientRepository = require("../repositories/clientRepository");
const {validateClientRegistration ,validateClientUpdate } = require('../validations/ClientValidations')


const createClient = async (client) => {
    const validationResult = await validateClientRegistration(client);
    if (!validationResult) {
        const error = new Error('Validation échouée');
        error.statusCode = 400;
        error.details = validationResult.errors;
        throw error;

    }
     return clientRepository.addClient(client);
}
const updateClient = async (id, data) => {
    const validationResult =  await validateClientUpdate(data)
    const client = await clientRepository.getClinetByID(id);
    if (!client) {
        const error = new Error('client not  found ');
        error.statusCode = 401;
        throw error;
    }
     else if (!validationResult) {
        const error = new Error('client data is not valid');
        error.statusCode = 401;
        error.details = validationResult.errors
        throw error;
    }

    return  await clientRepository.updateClient(id, data);
}

const deleteClient = async (id) => {
    const client = await clientRepository.getClinetByID(id);
    if (!client) {
        const error = new Error('client not  found ');
        error.statusCode = 401;
        throw error;
    }
    return await clientRepository.deleteClient(id);
}
const getClientByMatriculeFiscale = async (mf) => {
    if(!mf){
        const error = new Error('matrucuile fiscule should be not bll ');
        error.statusCode = 401;
        throw error;
    }
    const client = await clientRepository.getClientByMatriculeFiscale(mf);
    if(!client) {
        const error = new Error('client not  found ');
        error.statusCode = 401;
        throw error;
    }
    return client;
}

const getClientByID = async (id) => {
    const client = await clientRepository.getClientByMatriculeFiscale(id);
    if(!client) {
        const error = new Error('client not  found ');
        error.statusCode = 400;
        throw error;
    }
    return client;

}
const getAllClients = async () => {
    const clients = await clientRepository.getAllClients();
    if(!clients) {
        const error = new Error('client is required ');
        error.statusCode = 400;
        throw error;
    }
    return clients;
}

const searchClientsByName = async (name) => {
    if(!name) {
       const error = new Error('name is required');
       error.statusCode = 400;
       throw error;
    }
   return  clientRepository.searchClientsByName(name);

}
module.exports = {
    createClient,
    updateClient,
    deleteClient,
    getClientByMatriculeFiscale,
    getClientByID,
    getAllClients,
    searchClientsByName,
}