const quoteRepository = require('../repositories/quoteRepository');
const { calculateTotals, generateReference } = require('../utils/taxEngine');

const createQuote = async (data, companyId) => {
  const { clientId, items, is_suspended, notes, payment_terms, valid_until } = data;

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
  const validStatuses = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'];
  if (!validStatuses.includes(status)) {
    throw new Error('Statut invalide');
  }
  return await quoteRepository.updateStatus(id, status, companyId);
};

module.exports = {
  createQuote,
  getAll,
  getById,
  updateStatus,
};
