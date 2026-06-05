const prisma = require('../../config/db');

// Récupère toutes les catégories
const getAll = async () => {
    return await prisma.categorie.findMany();
};

// Récupère une catégorie par ID
const getById = async (id) => {
    return await prisma.categorie.findUnique({
        where: { id: id },
    });
};

// Crée une nouvelle catégorie
const create = async (data) => {
    return await prisma.categorie.create({ data });
};

// Met à jour une catégorie par ID
const update = async (id, updates) => {
    return await prisma.categorie.update({
        where: { id: id },
        data: updates,
    });
};

// Supprime une catégorie par ID
const deleteById = async (id) => {
    return await prisma.categorie.delete({
        where: { id: id },
    });
};

// Vérifie si une catégorie existe déjà avec le même nom ou code
const existsWithCodeOrName = async (code, name) => {
    const existing = await prisma.categorie.findFirst({
        where: {
            OR: [
                { code: parseInt(code) },
                { name: name },
            ],
        },
    });
    return !!existing;
};

module.exports = {
    getAll,
    getById,
    create,
    update,
    deleteById,
    existsWithCodeOrName,
};
