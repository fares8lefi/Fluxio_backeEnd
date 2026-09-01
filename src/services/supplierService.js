// Logique métier des fournisseurs : validation, vérification d'existence et délégation au repository.
const supplierRepository = require('../repositories/supplierRepository');
const { validateSupplierRegistration, validateSupplierUpdate } = require('../validations/SuppliersValidations');

// Crée un fournisseur avec validation
const addSupplier = async (data, companyId) => {
    const validationResult = validateSupplierRegistration(data);
    if (!validationResult.isValid) {
        const error = new Error('Validation échouée');
        error.statusCode = 400;
        error.details = validationResult.errors;
        throw error;
    }

    const { name, code, email, phone, address } = data;
    return await supplierRepository.create({ name, code, email, phone, address, companyId });
};

// Met à jour un fournisseur avec validation
const updateSupplier = async (id, data, companyId) => {
    const validationResult = validateSupplierUpdate(data);
    if (!validationResult.isValid) {
        const error = new Error('Validation échouée');
        error.statusCode = 400;
        error.details = validationResult.errors;
        throw error;
    }

    const existing = await supplierRepository.findById(id, companyId);
    if (!existing) {
        const error = new Error('Fournisseur introuvable');
        error.statusCode = 404;
        throw error;
    }

    const { name, code, email, phone, address } = data;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (code !== undefined) updates.code = code;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;

    return await supplierRepository.update(id, updates);
};

// Supprime un fournisseur
const deleteSupplier = async (id, companyId) => {
    const existing = await supplierRepository.findById(id, companyId);
    if (!existing) {
        const error = new Error('Fournisseur introuvable');
        error.statusCode = 404;
        throw error;
    }
    await supplierRepository.deleteById(id);
};

// Récupère les fournisseurs actifs
const getActiveSuppliers = async (companyId) => {
    return await supplierRepository.findActive(companyId);
};

// Récupère tous les fournisseurs
const getAllSuppliers = async (companyId) => {
    return await supplierRepository.findAll(companyId);
};

// Recherche par nom
const searchSuppliersByName = async (name, companyId) => {
    if (!name) {
        const error = new Error('Le paramètre name est requis');
        error.statusCode = 400;
        throw error;
    }
    return await supplierRepository.findByName(name, companyId);
};

// Désactive un fournisseur
const deactivateSupplier = async (id, companyId) => {
    const existing = await supplierRepository.findById(id, companyId);
    if (!existing) {
        const error = new Error('Fournisseur introuvable');
        error.statusCode = 404;
        throw error;
    }
    await supplierRepository.deactivate(id);
};

// Récupère un fournisseur par son ID
const getSupplierById = async (id, companyId) => {
    const supplier = await supplierRepository.findById(id, companyId);
    if (!supplier) {
        const error = new Error('Fournisseur introuvable');
        error.statusCode = 404;
        throw error;
    }
    return supplier;
};

module.exports = {
    addSupplier,
    updateSupplier,
    deleteSupplier,
    getActiveSuppliers,
    getAllSuppliers,
    searchSuppliersByName,
    deactivateSupplier,
    getSupplierById,
};
