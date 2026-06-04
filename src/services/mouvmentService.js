// Logique métier des mouvements de stock : l'import direct de productModel remplacé par productRepository, conformément à l'architecture en couches.
const mouvmentRepository = require('../repositories/mouvmentRepository');
const productRepository = require('../repositories/prdouctRepository');
const { validateMouvmentRegistration } = require('../validations/mouvmentValidations');

// Augmente le stock d'un produit
const increaseStock = async (productId, quantity) => {
    const product = await productRepository.getProductById(productId);
    if (!product) throw new Error('Produit introuvable');
    product.unit += quantity;
    await product.save();
};

// Diminue le stock d'un produit
const decreaseStock = async (productId, quantity) => {
    const product = await productRepository.getProductById(productId);
    if (!product) throw new Error('Produit introuvable');
    product.unit -= quantity;
    await product.save();
};

// Crée un nouveau mouvement avec gestion des stocks
const createMouvment = async (data, user) => {
    if (!user) {
        const error = new Error('Utilisateur non authentifié');
        error.statusCode = 401;
        throw error;
    }

    data.created_by = user._id;

    // Définir le prix unitaire si non fourni
    if (data.items && Array.isArray(data.items)) {
        for (let item of data.items) {
            if (item.unit_price === undefined || item.unit_price === null) {
                const product = await productRepository.getProductById(item.product);
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

    const { type, items, supplier, reference, note, status, created_by } = data;

    // Vérifier le stock pour les sorties
    if (['OUT', 'RETURN_SUPPLIER'].includes(type)) {
        for (const item of items) {
            const product = await productRepository.getProductById(item.product);
            if (!product) {
                const error = new Error(`Produit introuvable : ${item.product}`);
                error.statusCode = 404;
                throw error;
            }
            if (product.unit < item.unit) {
                const error = new Error(`Stock insuffisant pour le produit : ${product.name}`);
                error.statusCode = 400;
                throw error;
            }
        }
    }

    // Mise à jour des stocks
    for (const item of items) {
        if (['IN', 'RETURN_CLIENT'].includes(type)) {
            await increaseStock(item.product, item.unit);
        } else if (['OUT', 'RETURN_SUPPLIER'].includes(type)) {
            await decreaseStock(item.product, item.unit);
        }
    }

    return await mouvmentRepository.create({
        type,
        items,
        supplier,
        reference: reference || null,
        note: note || null,
        status: status || 'CONFIRMED',
        created_by,
    });
};

// Récupère les mouvements (avec pagination)
const getAllMouvments = async (page) => {
    const limit = parseInt(process.env.limitByPage) || 10;
    const numbrePage = parseInt(page) || 1;

    const mouvments = await mouvmentRepository.findPaginated(numbrePage, limit);
    const count = await mouvmentRepository.countAll();

    return { mouvments, count };
};

module.exports = {
    createMouvment,
    getAllMouvments,
};
