const prisma = require('../../config/db');

// Crée un fournisseur
const create = async (data) => {
    return  prisma.supplier.create({ data });
};

// Récupère tous les fournisseurs de la compagnie
const findAll = async (companyId) => {
    return  prisma.supplier.findMany({ where: { companyId } });
};

// Récupère les fournisseurs actifs (champs limités)
const findActive = async (companyId) => {
    return  prisma.supplier.findMany({
        where: { is_active: true, companyId },
        select: {
            id: true, name: true, code: true,
            email: true, phone: true, address: true,
        },
    });
};

// Récupère un fournisseur par ID (vérifie l'appartenance à la compagnie)
const findById = async (id, companyId) => {
    return  prisma.supplier.findFirst({
        where: { id, companyId },
    });
};

// Recherche des fournisseurs par nom (insensible à la casse)
const findByName = async (name, companyId) => {
    return  prisma.supplier.findMany({
        where: {
            name: { contains: name },
            companyId,
        },
    });
};

// Met à jour un fournisseur
const update = async (id, updates) => {
    return  prisma.supplier.update({
        where: { id },
        data: updates,
    });
};

// Supprime un fournisseur
const deleteById = async (id) => {
    return  prisma.supplier.delete({
        where: { id },
    });
};

// Désactive un fournisseur (soft delete)
const deactivate = async (id) => {
    return  prisma.supplier.update({
        where: { id },
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
