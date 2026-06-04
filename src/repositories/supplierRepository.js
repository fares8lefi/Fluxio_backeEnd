// Couche d'accès aux données pour les fournisseurs : centralise toutes les opérations Mongoose du module supplier.
const Supplier = require('../models/suppliersModel');

// Crée un fournisseur
const create = async (data) => {
    return await Supplier.create(data);
};

// Récupère tous les fournisseurs
const findAll = async () => {
    return await Supplier.find();
};

// Récupère les fournisseurs actifs
const findActive = async () => {
    return await Supplier.find({ is_active: true }).select('name code email phone address');
};

// Récupère un fournisseur par ID
const findById = async (id) => {
    return await Supplier.findById(id);
};

// Recherche des fournisseurs par nom (insensible à la casse)
const findByName = async (name) => {
    return await Supplier.find({ name: { $regex: name, $options: 'i' } });
};

// Met à jour un fournisseur
const update = async (id, updates) => {
    return await Supplier.findByIdAndUpdate(id, updates, { new: true });
};

// Supprime un fournisseur
const deleteById = async (id) => {
    return await Supplier.findByIdAndDelete(id);
};

// Désactive un fournisseur (is_active = false)
const deactivate = async (id) => {
    return await Supplier.findByIdAndUpdate(id, { is_active: false }, { new: true });
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
