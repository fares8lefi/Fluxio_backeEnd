// Logique métier des mouvements de stock
const prisma = require('../../config/db');
const mouvmentRepository = require('../repositories/mouvmentRepository');
const productRepository = require('../repositories/productRepository');
const { validateMouvmentRegistration } = require('../validations/mouvmentValidations');

/**
 * Augmente le stock d'un produit (entrée / retour client)
 */
const increaseStock = async (productId, quantity, companyId, tx) => {
    const product = await productRepository.getProductById(productId, companyId, tx);
    if (!product) {
        const error = new Error(`Produit introuvable : ${productId}`);
        error.statusCode = 404;
        throw error;
    }
    await productRepository.updateProduct(
        { stock_quantity: product.stock_quantity + quantity },
        productId,
        companyId,
        tx
    );
};

/**
 * Diminue le stock d'un produit (sortie / retour fournisseur)
 */
const decreaseStock = async (productId, quantity, companyId, tx) => {
    const product = await productRepository.getProductById(productId, companyId, tx);
    if (!product) {
        const error = new Error(`Produit introuvable : ${productId}`);
        error.statusCode = 404;
        throw error;
    }
    await productRepository.updateProduct(
        { stock_quantity: product.stock_quantity - quantity },
        productId,
        companyId,
        tx
    );
};

/**
 * Crée un nouveau mouvement avec gestion des stocks via une transaction.
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
                const product = await productRepository.getProductById(item.productId, user.companyId);
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

    // Envelopper dans une transaction
    return await prisma.$transaction(async (tx) => {
        // Vérifier le stock disponible pour les sorties
        if (['OUT', 'RETURN_SUPPLIER'].includes(type)) {
            for (const item of items) {
                const product = await productRepository.getProductById(item.productId, user.companyId, tx);
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
                await increaseStock(item.productId, item.quantity, user.companyId, tx);
            } else if (['OUT', 'RETURN_SUPPLIER'].includes(type)) {
                await decreaseStock(item.productId, item.quantity, user.companyId, tx);
            }
        }

        // Créer le mouvement
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
        }, tx);
    });
};

/**
 * Annule un mouvement et restaure les stocks
 */
const cancelMouvment = async (mouvmentId, companyId) => {
    return await prisma.$transaction(async (tx) => {
        const mouvment = await mouvmentRepository.getById(mouvmentId, companyId, tx);
        if (!mouvment) {
            const error = new Error('Mouvement introuvable');
            error.statusCode = 404;
            throw error;
        }

        if (mouvment.status === 'CANCELLED') {
            const error = new Error('Ce mouvement est déjà annulé');
            error.statusCode = 400;
            throw error;
        }

        // Effectuer l'opération inverse sur le stock
        for (const item of mouvment.items) {
            if (['IN', 'RETURN_CLIENT'].includes(mouvment.type)) {
                // Si c'était une entrée, on diminue le stock pour annuler
                await decreaseStock(item.productId, item.quantity, companyId, tx);
            } else if (['OUT', 'RETURN_SUPPLIER'].includes(mouvment.type)) {
                // Si c'était une sortie, on augmente le stock pour annuler
                await increaseStock(item.productId, item.quantity, companyId, tx);
            }
        }

        // Mettre à jour le statut
        return await mouvmentRepository.updateStatus(mouvmentId, 'CANCELLED', tx);
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
    cancelMouvment,
    getAllMouvments,
};
