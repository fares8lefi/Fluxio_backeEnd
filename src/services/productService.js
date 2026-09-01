// Logique métier des produits
const productRepository = require('../repositories/productRepository');
const supplierRepository = require('../repositories/supplierRepository');
const categorieRepository = require('../repositories/categorieRepository');
const { validateProductSearch } = require('../validations/ProductValidations');
const productValidations = require('../validations/ProductValidations');

const TVA_RATES = [0, 7, 13, 19];

// Ajoute un produit
const addProduct = async (data, companyId) => {
    const validationResult = await productValidations.validateProductRegistration(data);
    if (!validationResult.isValid) {
        const error = new Error('Validation échouée');
        error.statusCode = 400;
        error.details = validationResult.errors;
        throw error;
    }

    const {
        code, barcode, name, purchase_price, selling_price,
        stock_quantity, stock_min, stock_max,
        tva_rate, unit_of_measure,
        supplierId, categoryId,
    } = data;

    // Valider le taux TVA
    const tva = tva_rate ?? 19;
    if (!TVA_RATES.includes(tva)) {
        const error = new Error(`Taux TVA invalide. Valeurs acceptées : ${TVA_RATES.join(', ')}%`);
        error.statusCode = 400;
        throw error;
    }

    if (supplierId) {
        const supplier = await supplierRepository.findById(supplierId, companyId);
        if (!supplier) {
            const error = new Error('Fournisseur introuvable');
            error.statusCode = 404;
            throw error;
        }
    }

    if (categoryId) {
        const cat = await categorieRepository.getById(categoryId, companyId);
        if (!cat) {
            const error = new Error('Catégorie introuvable');
            error.statusCode = 404;
            throw error;
        }
    }

    return await productRepository.addProduct({
        code, barcode, name, purchase_price, selling_price,
        stock_quantity: stock_quantity ?? 0,
        stock_min, stock_max,
        tva_rate: tva,
        unit_of_measure: unit_of_measure ?? 'pièce',
        supplierId, categoryId, companyId,
    });
};

// Supprime un produit
const deleteProduct = async (id, companyId) => {
    const product = await productRepository.getProductById(id, companyId);
    if (!product) {
        const error = new Error('Produit introuvable');
        error.statusCode = 404;
        throw error;
    }
    return await productRepository.deleteProduct(id, companyId);
};

// Récupère tous les produits (liste simple)
const getAllProducts = async (companyId) => {
    return await productRepository.getAllProduct(companyId);
};

// Récupère les produits avec pagination
const getAllProductsPaginated = async (page, limit, companyId) => {
    const products = await productRepository.findPaginated(page, limit, companyId);
    const total = await productRepository.countAll(companyId);
    return { products, total };
};

// Récupère un produit par ID
const getProductById = async (id, companyId) => {
    const product = await productRepository.getProductById(id, companyId);
    if (!product) {
        const error = new Error('Produit introuvable');
        error.statusCode = 404;
        throw error;
    }
    return product;
};

// Met à jour un produit
const updateProduct = async (id, data, companyId) => {
    const existing = await productRepository.getProductById(id, companyId);
    if (!existing) {
        const error = new Error('Produit introuvable');
        error.statusCode = 404;
        throw error;
    }

    const {
        code, barcode, name, purchase_price, selling_price,
        stock_quantity, stock_min, stock_max,
        tva_rate, unit_of_measure, supplierId, categoryId,
    } = data;

    const updates = {};
    if (code           !== undefined) updates.code           = code;
    if (barcode        !== undefined) updates.barcode        = barcode;
    if (name           !== undefined) updates.name           = name;
    if (purchase_price !== undefined) updates.purchase_price = purchase_price;
    if (selling_price  !== undefined) updates.selling_price  = selling_price;
    if (stock_quantity !== undefined) updates.stock_quantity = stock_quantity;
    if (stock_min      !== undefined) updates.stock_min      = stock_min;
    if (stock_max      !== undefined) updates.stock_max      = stock_max;
    if (tva_rate       !== undefined) updates.tva_rate       = tva_rate;
    if (unit_of_measure !== undefined) updates.unit_of_measure = unit_of_measure;
    if (supplierId     !== undefined) updates.supplierId     = supplierId;
    if (categoryId     !== undefined) updates.categoryId     = categoryId;

    return await productRepository.updateProduct(updates, id, companyId);
};

// Recherche par filtres dynamiques
const getProductByFiltres = async (data, companyId) => {
    const validationResult = validateProductSearch(data);
    if (!validationResult.isValid) {
        const error = new Error('Paramètres invalides');
        error.statusCode = 400;
        throw error;
    }

    const { name, stock_quantity, maxPrice, minPrice } = validationResult.data;
    const filter = {};
    if (name)                  filter.name           = { contains: name };
    if (stock_quantity !== undefined) filter.stock_quantity = stock_quantity;
    if (maxPrice !== undefined && minPrice !== undefined) {
        filter.selling_price = { gte: minPrice, lte: maxPrice };
    } else if (maxPrice !== undefined) {
        filter.selling_price = { lte: maxPrice };
    } else if (minPrice !== undefined) {
        filter.selling_price = { gte: minPrice };
    }

    return await productRepository.getProductByFiltres({ ...filter, companyId });
};

// Produits groupés par catégorie
const getProductsByCategories = async (companyId) => {
    return await productRepository.getProductsByCategories(companyId);
};

// Nombre de produits par catégorie
const getSumProductByCategorie = async (companyId) => {
    return await productRepository.getSumProductByCategorie(companyId);
};

// Produits avec leur fournisseur
const getSuppliersByProduct = async (companyId) => {
    return await productRepository.getSuppliersByProduct(companyId);
};

// Produits en dessous du stock minimum
const getProductsBelowStockMin = async (companyId) => {
    return await productRepository.getProductsBelowStockMin(companyId);
};

const getOutOfStockProducts = async (companyId) => {
    return await productRepository.getOutOfStockProducts(companyId);
};

const getLowStockDashboard = async (companyId) => {
    return await productRepository.getLowStockDashboard(companyId);
}

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
    getProductsBelowStockMin,
    getOutOfStockProducts,
    getLowStockDashboard
};