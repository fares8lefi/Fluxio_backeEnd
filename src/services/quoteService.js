const quoteRepository = require('../repositories/quoteRepository');
const clientRepository = require('../repositories/clientRepository');
const { calculateTotals, generateReference } = require('../utils/taxEngine');
const { computeInvoiceReadiness } = require('../utils/invoiceReadiness');
const mouvmentService = require('./mouvmentService');
const invoiceService = require('./invoiceService');

const httpError = (message, statusCode, extra = {}) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
};

const createQuote = async (data, companyId) => {
  const { clientId, items, is_suspended, notes, payment_terms, valid_until } = data;
  // Le client doit appartenir à l'entreprise (sa fiche est renvoyée avec le devis)
  if (clientId && !(await clientRepository.getClientByID(clientId, companyId))) {
    throw httpError('Client introuvable', 404);
  }

  let parsedItems = [];
  if (Array.isArray(items)) {
    parsedItems = items;
  } else if (typeof items === 'string') {
    try {
      parsedItems = JSON.parse(items);
    } catch {
      parsedItems = [];
    }
  }

  const isSuspended = is_suspended === true || is_suspended === 'true';

  const { total_ht, tva_amount, total_ttc } = calculateTotals(parsedItems, {
    is_suspended: isSuspended,
    apply_rs: false,
  });

  const year = new Date().getFullYear();
  const lastNum = await quoteRepository.getLastReferenceNumber(companyId, year);
  const reference = generateReference('DEV', lastNum + 1);

  return await quoteRepository.createQuote({
    reference,
    status: 'DRAFT',
    total_ht,
    tva_amount,
    total_ttc,
    is_suspended: isSuspended,
    items: JSON.stringify(parsedItems),
    notes: notes || null,
    payment_terms: payment_terms || 'Validité 30 jours',
    valid_until: valid_until ? new Date(valid_until) : null,
    clientId: clientId || null,
    companyId,
  });
};

const getAll = async (companyId, filters = {}) => {
  return await quoteRepository.findAll(companyId, filters);
};

const getById = async (id, companyId) => {
  const quote = await quoteRepository.getById(id, companyId);
  if (!quote) {
    const err = new Error('Devis introuvable');
    err.statusCode = 404;
    throw err;
  }
  return quote;
};

const updateStatus = async (id, status, companyId) => {
  const validStatuses = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'];
  if (status === 'CONVERTED') {
    // Passer par convertToInvoice : un devis « converti » doit avoir une vraie facture
    throw httpError('Utilisez la conversion en facture pour convertir un devis', 400);
  }
  if (!validStatuses.includes(status)) {
    throw new Error('Statut invalide');
  }
  return await quoteRepository.updateStatus(id, status, companyId);
};

const round3 = (n) => Math.round(n * 1000) / 1000;

/**
 * Convertit un devis accepté en facture de vente :
 * 1. vérifie tout ce qui peut bloquer AVANT de toucher au stock ;
 * 2. crée la sortie de stock (mouvement OUT) avec les lignes du devis ;
 * 3. génère la facture à partir de ce mouvement ;
 * 4. relie le devis à la facture (statut CONVERTED).
 * Si la facture échoue après la sortie, le mouvement est annulé (stock rétabli).
 *
 * @param {string} id — devis
 * @param {object} user — utilisateur connecté (companyId, id)
 * @param {object} [options] — attestation_ref, purchase_order_ref, apply_rs, rs_rate
 * @returns {{ quote, invoice, movement }}
 */
const convertToInvoice = async (id, user, options = {}) => {
  const { companyId } = user;
  const quote = await quoteRepository.getById(id, companyId);
  if (!quote) throw httpError('Devis introuvable', 404);
  if (quote.invoice_id || quote.status === 'CONVERTED') {
    throw httpError('Ce devis a déjà été converti en facture', 409);
  }
  if (quote.status !== 'ACCEPTED') {
    throw httpError('Seul un devis accepté peut être converti en facture', 400);
  }

  let lines;
  try {
    lines = JSON.parse(quote.items || '[]');
  } catch {
    lines = [];
  }
  if (lines.length === 0) throw httpError('Le devis ne contient aucune ligne', 400);

  // Une sortie de stock exige des articles du catalogue
  const freeLines = lines.filter((l) => !l.productId).map((l) => l.name || 'Ligne sans nom');
  if (freeLines.length > 0) {
    throw httpError(
      `Ces lignes ne sont pas liées à un produit du catalogue : ${freeLines.join(', ')}`,
      400
    );
  }

  const isSuspended = quote.is_suspended === true;
  if (isSuspended && !options.attestation_ref) {
    throw httpError(
      "L'attestation fiscale est obligatoire pour une vente en suspension de TVA",
      400
    );
  }

  // Mentions obligatoires vérifiées avant de décrémenter le stock
  const readiness = computeInvoiceReadiness({
    movement: {
      items: lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unit_price: l.unit_price,
        product: { name: l.name, tva_rate: l.tva_rate },
      })),
    },
    company: quote.company,
    client: quote.client,
  });
  if (!readiness.is_ready) {
    throw httpError('Informations manquantes pour générer la facture', 400, {
      missing_fields: readiness.blocking_fields,
    });
  }

  // La remise du devis est intégrée au prix unitaire de la ligne de sortie
  const items = lines.map((l) => {
    const discount = Math.min(Math.max(Number(l.discount) || 0, 0), 100);
    return {
      productId: l.productId,
      quantity: Number(l.quantity),
      unit_price: round3(Number(l.unit_price) * (1 - discount / 100)),
      // Taux du devis, pas celui de la fiche produit : la facture doit reprendre le devis
      tva_rate: l.tva_rate,
    };
  });

  const movement = await mouvmentService.createMouvment(
    {
      type: 'OUT',
      items,
      clientId: quote.clientId,
      reference: quote.reference,
      note: `Livraison suite au devis ${quote.reference}`,
    },
    user,
    { keepTvaRate: true }
  );

  let invoice;
  try {
    invoice = await invoiceService.generateInvoiceFromMovement(movement.id, companyId, {
      is_suspended: isSuspended,
      attestation_ref: options.attestation_ref,
      purchase_order_ref: options.purchase_order_ref,
      apply_rs: options.apply_rs,
      rs_rate: options.rs_rate,
      payment_terms: quote.payment_terms,
      notes: `Facture établie sur le devis ${quote.reference}`,
    });
  } catch (error) {
    // Compensation : on ne laisse pas une sortie de stock sans facture
    await mouvmentService.cancelMouvment(movement.id, companyId).catch(() => {});
    throw error;
  }

  const updated = await quoteRepository.updateStatus(id, 'CONVERTED', companyId, {
    invoice_id: invoice.id,
  });

  return { quote: updated, invoice, movement };
};

module.exports = {
  createQuote,
  getAll,
  getById,
  updateStatus,
  convertToInvoice,
};
