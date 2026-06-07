const prisma = require('../../config/db');

// Crée une compagnie
const create = async (data) => {
    return  prisma.company.create({
        data,
    });
};

// Recherche par ID
const findById = async (id) => {
    return  prisma.company.findUnique({
        where: { id: id },
    });
};

// Met à jour une compagnie
const update = async (id, updates) => {
    return  prisma.company.update({
        where: { id: id },
        data: updates,
    });
};

module.exports = {
    create,
    findById,
    update,
};
