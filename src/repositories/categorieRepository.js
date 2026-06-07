const prisma = require('../../config/db');

// Récupère toutes les catégories de la compagnie
const getAll = async (companyId) => {
    return  prisma.category.findMany({ where: { companyId } });
};

// Récupère une catégorie par ID (vérifie l'appartenance à la compagnie)
const getById = async (id, companyId) => {
    return  prisma.category.findFirst({
        where: { id, companyId },
    });
};

// Crée une nouvelle catégorie
const create = async (data) => {
    return  prisma.category.create({ data });
};

// Met à jour une catégorie par ID
const update = async (id, updates) => {
    return  prisma.category.update({
        where: { id },
        data: updates,
    });
};

// Supprime une catégorie par ID
const deleteById = async (id) => {
    return  prisma.category.delete({
        where: { id },
    });
};

// Vérifie si une catégorie avec le même nom ou code existe déjà dans la compagnie
const existsWithCodeOrName = async (code, name, companyId) => {
    const existing = await prisma.category.findFirst({
        where: {
            companyId,
            OR: [
                { code: parseInt(code) },
                { name },
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
