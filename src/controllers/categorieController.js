const categorieService = require('../services/categorieService');

// POST /api/categories/createCategorie
module.exports.createcategory = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const categorie = await categorieService.createCategory(req.body, companyId);
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
module.exports.getAllCategories = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const categories = await categorieService.getAllCategories(companyId);
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
        const companyId = req.user.companyId;
        const { id } = req.params;
        const categorie = await categorieService.updateCategory(id, req.body, companyId);
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
        const companyId = req.user.companyId;
        const { id } = req.params;
        await categorieService.deleteCategory(id, companyId);
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

// GET /api/categories/:id
module.exports.getCategorieById = async (req, res) => {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        const categorie = await categorieService.getCategoryById(req.params.id, companyId);
        return res.status(200).json({ success: true, categorie });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

// GET /api/categories/searchByName?name=...
module.exports.searchCategoriesByName = async (req, res) => {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        const categories = await categorieService.searchCategoriesByName(req.query.name, companyId);
        if (categories.length === 0) {
            return res.status(404).json({ success: false, message: 'Aucune catégorie trouvée' });
        }
        return res.status(200).json({ success: true, count: categories.length, categories });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};
