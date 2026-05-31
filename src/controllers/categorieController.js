const categorieService = require('../services/categorieService');

// POST /api/categories/createCategorie
module.exports.createcategory = async (req, res) => {
    try {
        const categorie = await categorieService.createCategory(req.body);
        return res.status(201).json({ success: true, categorie });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { details: error.details }),
        });
    }
};

// GET /api/categories/getAllCategories
module.exports.getAllCategories = async (_req, res) => {
    try {
        const categories = await categorieService.getAllCategories();
        return res.status(200).json({ success: true, categories });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
        });
    }
};

// PUT /api/categories/updateCategorie/:id
module.exports.updateCategorie = async (req, res) => {
    try {
        const { id } = req.params;
        const categorie = await categorieService.updateCategory(id, req.body);
        return res.status(200).json({
            success: true,
            message: 'Catégorie mise à jour avec succès',
            categorie,
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { details: error.details }),
        });
    }
};

// DELETE /api/categories/deleteCategorie/:id
module.exports.deleteCategorie = async (req, res) => {
    try {
        const { id } = req.params;
        await categorieService.deleteCategory(id);
        return res.status(200).json({
            success: true,
            message: 'Catégorie supprimée avec succès',
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
        });
    }
};
