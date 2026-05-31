const categorieRepository = require('../repositories/categorieRepository');
const { validateCategorieRegistration, validateCategorieUpdate } = require('../validations/CategorieValidations');

// Crée une nouvelle catégorie
const createCategory = async (data) => {
    const validationResult = validateCategorieRegistration(data);
    if (!validationResult.isValid) {
        const error = new Error('Validation échouée');
        error.statusCode = 400;
        error.details = validationResult.errors;
        throw error;
    }

    const { name, code, description } = data;

    const alreadyExists = await categorieRepository.existsWithCodeOrName(code, name);
    if (alreadyExists) {
        const error = new Error('Une catégorie avec ce nom ou ce code existe déjà');
        error.statusCode = 409;
        throw error;
    }

    return await categorieRepository.create({ name, code, description });
};

// Récupère toutes les catégories
const getAllCategories = async () => {
    return await categorieRepository.getAll();
};

// Met à jour une catégorie existante
const updateCategory = async (id, data) => {
    const validationResult = validateCategorieUpdate(data);
    if (!validationResult.isValid) {
        const error = new Error('Validation échouée');
        error.statusCode = 400;
        error.details = validationResult.errors;
        throw error;
    }

    const categorie = await categorieRepository.getById(id);
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
const deleteCategory = async (id) => {
    const categorie = await categorieRepository.getById(id);
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
