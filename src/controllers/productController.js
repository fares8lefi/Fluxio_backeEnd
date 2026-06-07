// Contrôleur produits : gestion HTTP uniquement — chaque handler délègue entièrement au service sans accès direct aux modèles.
const productService = require('../services/productService');
const { validateProductUpdate } = require('../validations/ProductValidations');

// POST /api/products/addProduct
module.exports.addProduct = async (req, res) => {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        const product = await productService.addProduct(req.body, companyId);
        return res.status(201).json({ success: true, message: 'Produit créé avec succès', product });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { details: error.details }),
        });
    }
};

// DELETE /api/products/deleteProduct/:id
module.exports.deleteProduct = async function (req, res) {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        await productService.deleteProduct(req.params.id, companyId);
        return res.status(200).json({ success: true, message: 'Produit supprimé avec succès' });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

// GET /api/products/getAllProduct  (avec pagination)
module.exports.getAllProduct = async function (req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const companyId = (req.user || req.session?.user)?.companyId;

        const { products, total } = await productService.getAllProductsPaginated(page, limit, companyId);

        if (products.length === 0) {
            return res.status(404).json({ success: false, message: 'Aucun produit trouvé' });
        }

        return res.status(200).json({
            success: true,
            products,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

// PUT /api/products/updateProduct/:id
module.exports.updateProduct = async function (req, res) {
    try {
        const validationResult = validateProductUpdate(req.body);
        if (!validationResult.isValid) {
            return res.status(400).json({ success: false, message: validationResult.errors });
        }

        const companyId = (req.user || req.session?.user)?.companyId;
        const updatedProduct = await productService.updateProduct(req.params.id, req.body, companyId);
        return res.status(200).json({
            success: true,
            message: 'Produit mis à jour avec succès',
            product: updatedProduct,
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

// GET /api/products/getProductById/:id
module.exports.getProductById = async function (req, res) {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        const product = await productService.getProductById(req.params.id, companyId);
        return res.status(200).json({ success: true, product });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { details: error.details }),
        });
    }
};

// GET /api/products/getProductByFiltres?name=...&unit=...&minPrice=...&maxPrice=...
module.exports.getProductByFiltres = async function (req, res) {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        const products = await productService.getProductByFiltres(req.query, companyId);
        if (products.length === 0) {
            return res.status(404).json({ success: false, message: 'Aucun produit trouvé' });
        }
        return res.status(200).json({ success: true, products });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { details: error.details }),
        });
    }
};

// GET /api/products/getSumProductByCategorie
module.exports.getSumProductByCategorie = async function (req, res) {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        const products = await productService.getSumProductByCategorie(companyId);
        return res.status(200).json({ success: true, products });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/products/getProductsByCategories
module.exports.getProductsByCategories = async function (req, res) {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        const products = await productService.getProductsByCategories(companyId);
        if (products.length === 0) {
            return res.status(404).json({ success: false, message: 'Aucun produit trouvé' });
        }
        return res.status(200).json({ success: true, products });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/products/getSuppliersByProduct
module.exports.getSuppliersByProduct = async function (req, res) {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        const products = await productService.getSuppliersByProduct(companyId);
        return res.status(200).json({ success: true, products });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/products/getProductsBelowStockMin
module.exports.getProductsBelowStockMin = async function (req, res) {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        const products = await productService.getProductsBelowStockMin(companyId);
        return res.status(200).json({ success: true, products });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
