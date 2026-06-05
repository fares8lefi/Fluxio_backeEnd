const prisma = require('../../config/db');

// Crée un fournisseur
const create = async (data) => {
    return await prisma.suppliers.create({ data });
};

// Récupère tous les fournisseurs
const findAll = async () => {
    return await prisma.suppliers.findMany();
};

// Récupère les fournisseurs actifs (champs limités)
const findActive = async () => {
    return await prisma.suppliers.findMany({
        where: { is_active: true },
        select: {
            id: true, name: true, code: true,
            email: true, phone: true, address: true,
        },
    });
};

// Récupère un fournisseur par ID
const findById = async (id) => {
    return await prisma.suppliers.findUnique({
        where: { id: parseInt(id) },
    });
};

// Recherche des fournisseurs par nom (insensible à la casse)
const findByName = async (name) => {
    return await prisma.suppliers.findMany({
        where: {
            name: { contains: name },
        },
    });
};

// Met à jour un fournisseur
const update = async (id, updates) => {
    return await prisma.suppliers.update({
        where: { id: parseInt(id) },
        data: updates,
    });
};

// Supprime un fournisseur
const deleteById = async (id) => {
    return await prisma.suppliers.delete({
        where: { id: parseInt(id) },
    });
};

// Désactive un fournisseur (is_active = false)
const deactivate = async (id) => {
    return await prisma.suppliers.update({
        where: { id: parseInt(id) },
        data: { is_active: false },
    });
};

module.exports = {
    create,
    findAll,
    findActive,
    findById,
    findByName,
    update,
    deleteById,
    deactivate,
};
