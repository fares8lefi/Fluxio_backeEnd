// Logique métier des mouvements de stock
const prisma = require('../../config/db');
const mouvmentRepository = require('../repositories/mouvmentRepository');
const productRepository = require('../repositories/productRepository');
const clientRepository = require('../repositories/clientRepository');
const supplierRepository = require('../repositories/supplierRepository');
const { validateMouvmentRegistration } = require('../validations/mouvmentValidations');
const { resolveTvaRate } = require('../utils/taxEngine');

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
 * Le client et le fournisseur rattachés doivent appartenir à l'entreprise
 * (sinon leur fiche d'une autre entreprise serait liée et renvoyée).
 */
const assertOwnParties = async ({ clientId, supplierId }, companyId) => {
  if (clientId && !(await clientRepository.getClientByID(clientId, companyId))) {
    const error = new Error('Client introuvable');
    error.statusCode = 404;
    throw error;
  }
  if (supplierId && !(await supplierRepository.findById(supplierId, companyId))) {
    const error = new Error('Fournisseur introuvable');
    error.statusCode = 404;
    throw error;
  }
};

/**
 * Crée un nouveau mouvement avec gestion des stocks via une transaction.
 */
/**
 * @param {object} [options]
 * @param {boolean} [options.keepTvaRate] — garder le taux de TVA fourni sur chaque ligne
 *   (conversion d'un devis : la facture doit reprendre le taux du devis). Usage interne.
 */
const createMouvment = async (data, user, { keepTvaRate = false } = {}) => {
  if (!user) {
    const error = new Error('Utilisateur non authentifié');
    error.statusCode = 401;
    throw error;
  }

  data.createdById = user.id;

  // Prix unitaire par défaut + instantané du taux de TVA et du prix d'achat :
  // une facture réimprimée et la marge restent justes si la fiche produit change
  if (data.items && Array.isArray(data.items)) {
    for (const item of data.items) {
      const product = await productRepository.getProductById(item.productId, user.companyId);
      if (!product) continue;
      if (item.unit_price === undefined || item.unit_price === null) {
        item.unit_price = ['OUT', 'RETURN_CLIENT'].includes(data.type)
          ? product.selling_price
          : product.purchase_price;
      }
      item.tva_rate =
        keepTvaRate && item.tva_rate !== undefined && item.tva_rate !== null
          ? resolveTvaRate(item.tva_rate, `« ${product.name} »`)
          : product.tva_rate;
      item.purchase_price = product.purchase_price;
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
  await assertOwnParties({ clientId, supplierId }, user.companyId);
  // Facture fournisseur : uniquement pour une entrée de stock
  const supplierInvoice =
    type === 'IN'
      ? {
          supplier_invoice_ref: data.supplier_invoice_ref?.trim() || null,
          supplier_invoice_date: data.supplier_invoice_date
            ? new Date(data.supplier_invoice_date)
            : null,
        }
      : {};

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
    return await mouvmentRepository.create(
      {
        type,
        items,
        supplierId: supplierId || null,
        clientId: clientId || null,
        reference: reference || null,
        note: note || null,
        ...supplierInvoice,
        status: status || 'CONFIRMED',
        createdById,
        companyId: user.companyId,
      },
      tx
    );
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
      } else if (mouvment.type === 'ADJUSTMENT') {
        // Quantité signée : on retire l'écart appliqué (sans passer sous zéro)
        const product = await productRepository.getProductById(item.productId, companyId, tx);
        if (product && product.stock_quantity - item.quantity < 0) {
          const error = new Error(
            `Annulation impossible : le stock de « ${product.name} » deviendrait négatif`
          );
          error.statusCode = 400;
          throw error;
        }
        await increaseStock(item.productId, -item.quantity, companyId, tx);
      }
    }

    // Mettre à jour le statut
    return await mouvmentRepository.updateStatus(mouvmentId, 'CANCELLED', tx);
  });
};

/**
 * Récupère les mouvements paginés avec filtres optionnels
 * Filtres supportés : type, status, clientId, supplierId, startDate, endDate
 *
 * @param {number|string} page
 * @param {string} companyId
 * @param {object} filters
 * @param {number|string} [limitOverride] — taille de page optionnelle (ex: 5 pour
 *   le journal du tableau de bord). Bornée à 100 ; sans effet si absent.
 */
const getAllMouvments = async (page, companyId, filters = {}, limitOverride) => {
  const parsedLimit = parseInt(limitOverride, 10);
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 100)
      : parseInt(process.env.limitByPage) || 10;
  const numbrePage = parseInt(page) || 1;

  const mouvments = await mouvmentRepository.findPaginated(numbrePage, limit, companyId, filters);
  const count = await mouvmentRepository.countFiltered(companyId, filters);

  return { mouvments, count };
};

/**
 * Récupère tous les mouvements liés à un client
 */
const getMouvmentsByClient = async (clientId, companyId) => {
  if (!clientId) {
    const error = new Error('clientId est requis');
    error.statusCode = 400;
    throw error;
  }
  const mouvments = await mouvmentRepository.findByClientId(clientId, companyId);
  return { mouvments, count: mouvments.length };
};

/**
 * Récupère tous les mouvements liés à un fournisseur
 */
const getMouvmentsBySupplier = async (supplierId, companyId) => {
  if (!supplierId) {
    const error = new Error('supplierId est requis');
    error.statusCode = 400;
    throw error;
  }
  const mouvments = await mouvmentRepository.findBySupplierId(supplierId, companyId);
  return { mouvments, count: mouvments.length };
};

module.exports = {
  createMouvment,
  cancelMouvment,
  getAllMouvments,
  getMouvmentsByClient,
  getMouvmentsBySupplier,
  getMouvmentById: async (id, companyId) => {
    const mouvment = await mouvmentRepository.getById(id, companyId);
    if (!mouvment) {
      const error = new Error('Mouvement introuvable');
      error.statusCode = 404;
      throw error;
    }
    return mouvment;
  },
};
