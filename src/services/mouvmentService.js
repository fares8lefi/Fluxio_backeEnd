// Logique métier des mouvements de stock
const mouvmentRepository = require('../repositories/mouvmentRepository');
const productRepository = require('../repositories/productRepository');
const { validateMouvmentRegistration } = require('../validations/mouvmentValidations');

/**
 * Augmente le stock d'un produit (entrée / retour client)
 */
const increaseStock = async (productId, quantity) => {
    const product = await productRepository.getProductById(productId);
    if (!product) {
        const error = new Error(`Produit introuvable : ${productId}`);
        error.statusCode = 404;
        throw error;
    }
    await productRepository.updateProduct(
        { stock_quantity: product.stock_quantity + quantity },
        productId
    );
};

/**
 * Diminue le stock d'un produit (sortie / retour fournisseur)
 */
const decreaseStock = async (productId, quantity) => {
    const product = await productRepository.getProductById(productId);
    if (!product) {
        const error = new Error(`Produit introuvable : ${productId}`);
        error.statusCode = 404;
        throw error;
    }
    await productRepository.updateProduct(
        { stock_quantity: product.stock_quantity - quantity },
        productId
    );
};

/**
 * Crée un nouveau mouvement avec gestion des stocks.
 * Chaque item doit contenir : { productId, quantity, unit_price? }
 */
const createMouvment = async (data, user) => {
    if (!user) {
        const error = new Error('Utilisateur non authentifié');
        error.statusCode = 401;
        throw error;
    }

    data.createdById = user.id;

    // Définir le prix unitaire si non fourni (depuis le catalogue produit)
    if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
            if (item.unit_price === undefined || item.unit_price === null) {
                const product = await productRepository.getProductById(item.productId);
                if (product) {
                    item.unit_price = ['OUT', 'RETURN_CLIENT'].includes(data.type)
                        ? product.selling_price
                        : product.purchase_price;
                }
            }
        }
    }

    const validationResult = validateMouvmentRegistration(data);
    if (!validationResult.isValid) {
        const error = new Error('Validation échouée');
        error.statusCode = 400;
        error.details = validationResult.errors;
        throw error;
    }

    const { type, items, supplierId, clientId, reference, note, status, createdById } = data;

    // Vérifier le stock disponible pour les sorties
    if (['OUT', 'RETURN_SUPPLIER'].includes(type)) {
        for (const item of items) {
            const product = await productRepository.getProductById(item.productId);
            if (!product) {
                const error = new Error(`Produit introuvable : ${item.productId}`);
                error.statusCode = 404;
                throw error;
            }
            if (product.stock_quantity < item.quantity) {
                const error = new Error(
                    `Stock insuffisant pour le produit "${product.name}" — disponible : ${product.stock_quantity}, demandé : ${item.quantity}`
                );
                error.statusCode = 400;
                throw error;
            }
        }
    }

    // Mise à jour des stocks
    for (const item of items) {
        if (['IN', 'RETURN_CLIENT'].includes(type)) {
            await increaseStock(item.productId, item.quantity);
        } else if (['OUT', 'RETURN_SUPPLIER'].includes(type)) {
            await decreaseStock(item.productId, item.quantity);
        }
    }

    return await mouvmentRepository.create({
        type,
        items,
        supplierId:  supplierId  || null,
        clientId:    clientId    || null,
        reference:   reference   || null,
        note:        note        || null,
        status:      status      || 'CONFIRMED',
        createdById,
        companyId:   user.companyId,
    });
};

/**
 * Récupère les mouvements paginés de la compagnie
 */
const getAllMouvments = async (page, companyId) => {
    const limit = parseInt(process.env.limitByPage) || 10;
    const numbrePage = parseInt(page) || 1;

    const mouvments = await mouvmentRepository.findPaginated(numbrePage, limit, companyId);
    const count     = await mouvmentRepository.countAll(companyId);

    return { mouvments, count };
};

module.exports = {
    createMouvment,
    getAllMouvments,
};
