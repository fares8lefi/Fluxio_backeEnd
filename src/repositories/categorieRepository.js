const Categorie = require('../models/categorieModel');

// Récupère toutes les catégories
const getAll = async () => {
    return await Categorie.find();
};

// Récupère une catégorie par ID
const getById = async (id) => {
    return await Categorie.findById(id);
};

// Crée une nouvelle catégorie
const create = async (data) => {
    return await Categorie.create(data);
};

// Met à jour une catégorie par ID
const update = async (id, updates) => {
    return await Categorie.findByIdAndUpdate(id, updates, { new: true });
};

// Supprime une catégorie par ID
const deleteById = async (id) => {
    return await Categorie.findByIdAndDelete(id);
};

// Vérifie si une catégorie existe déjà avec le même nom ou code
const existsWithCodeOrName = async (code, name) => {
    return await Categorie.verifNameCode(code, name);
};

module.exports = {
    getAll,
    getById,
    create,
    update,
    deleteById,
    existsWithCodeOrName,
};
