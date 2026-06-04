// Logique métier des produits : validation, vérifications métier et orchestration du repository — aucun accès direct au modèle Mongoose.
const productRepository = require('../repositories/prdouctRepository');
const supplierModel = require('../models/suppliersModel');
const categoryModel = require('../models/categorieModel');
const { validateProductSearch } = require('../validations/ProductValidations');
const productValidations = require('../validations/ProductValidations');

// Ajoute un produit
const addProduct = async (data, user) => {
    const validationResult = await productValidations.validateProductRegistration(data);
    if (!validationResult.isValid) {
        const error = new Error('Validation échouée');
        error.statusCode = 400;
        error.details = validationResult.errors;
        throw error;
    }

    const { code, barcode, name, purchase_price, selling_price, unit, stock_min, upplier, categories } = data;

    const supplier = await supplierModel.findById(upplier);
    if (!supplier) {
        const error = new Error('Fournisseur introuvable');
        error.statusCode = 404;
        throw error;
    }

    const cat = await categoryModel.findById(categories);
    if (!cat) {
        const error = new Error('Catégorie introuvable');
        error.statusCode = 404;
        throw error;
    }

    return await productRepository.addProduct({ code, barcode, name, purchase_price, selling_price, unit, stock_min, upplier, categories });
};

// Supprime un produit
const deleteProduct = async (id) => {
    const product = await productRepository.getProductById(id);
    if (!product) {
        const error = new Error('Produit introuvable');
        error.statusCode = 404;
        throw error;
    }
    return await productRepository.deleteProduct(id);
};

// Récupère tous les produits (liste simple)
const getAllProducts = async () => {
    return await productRepository.getAllProduct();
};

// Récupère les produits avec pagination
const getAllProductsPaginated = async (page, limit) => {
    const products = await productRepository.findPaginated(page, limit);
    const total = await productRepository.countAll();
    return { products, total };
};

// Récupère un produit par ID
const getProductById = async (id) => {
    const product = await productRepository.getProductById(id);
    if (!product) {
        const error = new Error('Produit introuvable');
        error.statusCode = 404;
        throw error;
    }
    return product;
};

// Met à jour un produit
const updateProduct = async (id, data) => {
    const existing = await productRepository.getProductById(id);
    if (!existing) {
        const error = new Error('Produit introuvable');
        error.statusCode = 404;
        throw error;
    }

    const { code, barcode, name, purchase_price, selling_price, unit, stock_min, supplier, categories } = data;
    const updates = {};
    if (code !== undefined) updates.code = code;
    if (barcode !== undefined) updates.barcode = barcode;
    if (name !== undefined) updates.name = name;
    if (purchase_price !== undefined) updates.purchase_price = purchase_price;
    if (selling_price !== undefined) updates.selling_price = selling_price;
    if (unit !== undefined) updates.unit = unit;
    if (stock_min !== undefined) updates.stock_min = stock_min;
    if (supplier !== undefined) updates.supplier = supplier;
    if (categories !== undefined) updates.categories = categories;

    return await productRepository.updateProduct(updates, id);
};

// Recherche par filtres dynamiques
const getProductByFiltres = async (data) => {
    const validationResult = validateProductSearch(data);
    if (!validationResult.isValid) {
        const error = new Error('Paramètres invalides');
        error.statusCode = 400;
        throw error;
    }

    const { name, unit, maxPrice, minPrice } = validationResult.data;
    const filter = {};
    if (name) filter.name = { $regex: name, $options: 'i' };
    if (unit !== undefined) filter.unit = unit;
    if (maxPrice !== undefined && minPrice !== undefined) {
        filter.selling_price = { $gte: minPrice, $lte: maxPrice };
    } else if (maxPrice !== undefined) {
        filter.selling_price = { $lte: maxPrice };
    } else if (minPrice !== undefined) {
        filter.selling_price = { $gte: minPrice };
    }

    return await productRepository.getProductByFiltres(filter);
};

// Produits groupés par catégorie
const getProductsByCategories = async () => {
    return await productRepository.getProductsByCategories();
};

// Nombre de produits par catégorie
const getSumProductByCategorie = async () => {
    return await productRepository.getSumProductByCategorie();
};

// Produits avec leur fournisseur
const getSuppliersByProduct = async () => {
    return await productRepository.getSuppliersByProduct();
};

module.exports = {
    addProduct,
    deleteProduct,
    getAllProducts,
    getAllProductsPaginated,
    getProductById,
    updateProduct,
    getProductByFiltres,
    getProductsByCategories,
    getSumProductByCategorie,
    getSuppliersByProduct,
};