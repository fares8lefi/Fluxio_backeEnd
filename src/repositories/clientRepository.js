const prisma = require('../../config/db');

// Crée un client
const addClient = async (data) => {
    return prisma.client.create({ data });
};

// Recherche un client par matricule fiscale dans la compagnie
const getClientByMatriculeFiscale = async (matricule, companyId) => {
    return prisma.client.findFirst({
        where: { matriculeFiscale: matricule, companyId },
    });
};

// Met à jour un client
const updateClient = async (id, updates) => {
    return prisma.client.update({
        where: { id },
        data: updates,
    });
};

// Supprime un client
const deleteClient = async (id) => {
    return prisma.client.delete({ where: { id } });
};

// Récupère un client par ID (vérifie l'appartenance à la compagnie)
const getClientByID = async (id, companyId) => {
    return prisma.client.findFirst({ where: { id, companyId } });
};

// Récupère tous les clients de la compagnie
const getAllClients = async (companyId) => {
    return prisma.client.findMany({ where: { companyId } });
};

// Recherche des clients par nom (insensible à la casse)
const searchClientsByName = async (name, companyId) => {
    return prisma.client.findMany({
        where: {
            companyId,
            name: { contains: name },
        },
    });
};

module.exports = {
    addClient,
    getClientByMatriculeFiscale,
    getAllClients,
    updateClient,
    deleteClient,
    getClientByID,
    searchClientsByName,
};