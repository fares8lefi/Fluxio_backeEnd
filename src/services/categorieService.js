const categorieRepository = require('../repositories/categorieRepository');
const { validateCategorieRegistration, validateCategorieUpdate } = require('../validations/CategorieValidations');

// Crée une nouvelle catégorie
const createCategory = async (data, companyId) => {
    const validationResult = validateCategorieRegistration(data);
    if (!validationResult.isValid) {
        const error = new Error('Validation échouée');
        error.statusCode = 400;
        error.details = validationResult.errors;
        throw error;
    }

    const { name, code, description } = data;

    const alreadyExists = await categorieRepository.existsWithCodeOrName(code, name, companyId);
    if (alreadyExists) {
        const error = new Error('Une catégorie avec ce nom ou ce code existe déjà');
        error.statusCode = 409;
        throw error;
    }

    return await categorieRepository.create({ name, code, description, companyId });
};

// Récupère toutes les catégories
const getAllCategories = async (companyId) => {
    return await categorieRepository.getAll(companyId);
};

// Met à jour une catégorie existante
const updateCategory = async (id, data, companyId) => {
    const validationResult = validateCategorieUpdate(data);
    if (!validationResult.isValid) {
        const error = new Error('Validation échouée');
        error.statusCode = 400;
        error.details = validationResult.errors;
        throw error;
    }

    const categorie = await categorieRepository.getById(id, companyId);
    if (!categorie) {
        const error = new Error('Catégorie introuvable');
        error.statusCode = 404;
        throw error;
    }

    const { name, code, description } = data;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (code !== undefined) updates.code = code;
    if (description !== undefined) updates.description = description;

    return await categorieRepository.update(id, updates);
};

// Supprime une catégorie
const deleteCategory = async (id, companyId) => {
    const categorie = await categorieRepository.getById(id, companyId);
    if (!categorie) {
        const error = new Error('Catégorie introuvable');
        error.statusCode = 404;
        throw error;
    }

    await categorieRepository.deleteById(id);
};

module.exports = {
    createCategory,
    getAllCategories,
    updateCategory,
    deleteCategory,
};
