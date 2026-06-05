// Logique métier des produits — tous les imports de modèles Mongoose remplacés par les repositories.
const productRepository = require('../repositories/prdouctRepository');
const supplierRepository = require('../repositories/supplierRepository');
const categorieRepository = require('../repositories/categorieRepository');
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

    const { code, barcode, name, purchase_price, selling_price, unit, stock_min, supplierId, categorieId } = data;

    if (supplierId) {
        const supplier = await supplierRepository.findById(supplierId);
        if (!supplier) {
            const error = new Error('Fournisseur introuvable');
            error.statusCode = 404;
            throw error;
        }
    }

    if (categorieId) {
        const cat = await categorieRepository.getById(categorieId);
        if (!cat) {
            const error = new Error('Catégorie introuvable');
            error.statusCode = 404;
            throw error;
        }
    }

    return await productRepository.addProduct({ code, barcode, name, purchase_price, selling_price, unit, stock_min, supplierId, categorieId });
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

    const { code, barcode, name, purchase_price, selling_price, unit, stock_min, supplierId } = data;
    const updates = {};
    if (code !== undefined) updates.code = code;
    if (barcode !== undefined) updates.barcode = barcode;
    if (name !== undefined) updates.name = name;
    if (purchase_price !== undefined) updates.purchase_price = purchase_price;
    if (selling_price !== undefined) updates.selling_price = selling_price;
    if (unit !== undefined) updates.unit = unit;
    if (stock_min !== undefined) updates.stock_min = stock_min;
    if (supplierId !== undefined) updates.supplierId = supplierId;

    return await productRepository.updateProduct(updates, id);
};

// Recherche par filtres dynamiques — $regex Mongoose remplacé par filtres Prisma
const getProductByFiltres = async (data) => {
    const validationResult = validateProductSearch(data);
    if (!validationResult.isValid) {
        const error = new Error('Paramètres invalides');
        error.statusCode = 400;
        throw error;
    }

    const { name, unit, maxPrice, minPrice } = validationResult.data;
    const filter = {};
    if (name) filter.name = { contains: name };
    if (unit !== undefined) filter.unit = unit;
    if (maxPrice !== undefined && minPrice !== undefined) {
        filter.selling_price = { gte: minPrice, lte: maxPrice };
    } else if (maxPrice !== undefined) {
        filter.selling_price = { lte: maxPrice };
    } else if (minPrice !== undefined) {
        filter.selling_price = { gte: minPrice };
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