const invoiceRepository = require('../repositories/invoiceRepository');
const mouvmentRepository = require('../repositories/mouvmentRepository');
const clientRepository = require('../repositories/clientRepository');
const companyRepository = require('../repositories/companyRepository');
const { calculateTotals, amountToWords, generateReference } = require('../utils/taxEngine');
const {
  computeInvoiceReadiness,
  getCompanyMissingFields,
} = require('../utils/invoiceReadiness');
const {
  validateClientRegistration,
  validateClientUpdate,
} = require('../validations/ClientValidations');

// Champs modifiables depuis le formulaire de complétion
const CLIENT_FORM_FIELDS = ['name', 'phone', 'matriculeFiscale', 'address', 'codeTva'];
const COMPANY_FORM_FIELDS = ['matriculeFiscale', 'address', 'phone'];

const buildHttpError = (message, statusCode, extra = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
};

/**
 * Ne garde que les champs réellement remplis dans le formulaire
 */
const pickFilledFields = (payload, fields) => {
  if (!payload || typeof payload !== 'object') return null;
  const data = {};
  fields.forEach((field) => {
    const value = payload[field];
    if (typeof value === 'string' && value.trim() !== '') {
      data[field] = value.trim();
    }
  });
  return Object.keys(data).length > 0 ? data : null;
};

/**
 * Résout le client de la facture : sélection, complétion ou création via le formulaire
 */
const resolveInvoiceClient = async (movement, companyId, options = {}) => {
  const rawClient =
    options.client && typeof options.client === 'object' && !Array.isArray(options.client)
      ? options.client
      : null;
  const formData = pickFilledFields(rawClient, CLIENT_FORM_FIELDS);
  const targetId = options.clientId || rawClient?.id || movement.clientId || null;

  if (!formData) {
    if (!targetId) return null;
    const existing = await clientRepository.getClientByID(targetId, companyId);
    if (!existing) throw buildHttpError('Client introuvable', 404);
    return existing;
  }

  if (targetId) {
    const existing = await clientRepository.getClientByID(targetId, companyId);
    if (!existing) throw buildHttpError('Client introuvable', 404);

    const validation = validateClientUpdate(formData);
    if (!validation.isValid) {
      throw buildHttpError('Données client invalides', 400, { details: validation.errors });
    }
    const updated = await clientRepository.updateClient(targetId, formData);
    return { ...existing, ...updated, ...formData };
  }

  const validation = validateClientRegistration(formData);
  if (!validation.isValid) {
    throw buildHttpError('Données client invalides', 400, { details: validation.errors });
  }
  const created = await clientRepository.addClient({ ...formData, companyId });
  return { ...created, ...formData };
};

/**
 * Complète les informations de l'entreprise émettrice
 */
const completeCompany = async (companyId, options = {}) => {
  const patch = pickFilledFields(options.company, COMPANY_FORM_FIELDS);
  const company = await companyRepository.findById(companyId);

  if (!company) throw buildHttpError('Entreprise introuvable', 404);
  if (!patch) return company;

  await companyRepository.update(companyId, patch);
  return { ...company, ...patch };
};

/**
 * Construit la réponse "candidat à la facturation" pour un mouvement OUT
 */
const buildInvoiceCandidate = (movement, company) => {
  const items = (movement.items || []).map((item) => ({
    id: item.id,
    productId: item.productId,
    productName: item.product?.name || 'Produit',
    productCode: item.product?.code ?? null,
    unitOfMeasure: item.product?.unit_of_measure || null,
    quantity: item.quantity,
    unit_price: item.unit_price,
    tva_rate: item.product?.tva_rate ?? 19,
    total_ht: parseFloat((Number(item.quantity) * Number(item.unit_price) || 0).toFixed(3)),
  }));

  const totals = calculateTotals(items, { is_suspended: false, apply_rs: false });
  const readiness = computeInvoiceReadiness({
    movement,
    company,
    client: movement.client,
  });

  return {
    id: movement.id,
    type: movement.type,
    reference: movement.reference,
    note: movement.note,
    status: movement.status,
    date: movement.created_at,
    total_amount: movement.total_amount,
    created_by: movement.created_by || null,
    client: movement.client
      ? {
          id: movement.client.id,
          name: movement.client.name,
          matriculeFiscale: movement.client.matriculeFiscale,
          codeTva: movement.client.codeTva,
          address: movement.client.address,
          phone: movement.client.phone,
          is_active: movement.client.is_active,
        }
      : null,
    items,
    items_count: items.length,
    total_quantity: items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    preview: {
      ...totals,
      amount_in_words: amountToWords(totals.net_payable),
    },
    has_invoice: Boolean(movement.invoice),
    invoice: movement.invoice || null,
    can_generate: !movement.invoice && readiness.is_ready,
    needs_form: !movement.invoice && !readiness.is_complete,
    readiness,
    suggested_options: {
      notes: movement.note || null,
      payment_terms: 'Paiement comptant',
      is_suspended: false,
      apply_rs: false,
      rs_rate: 1.0,
    },
  };
};

/**
 * Liste les mouvements OUT éligibles à la génération d'une facture de vente,
 * avec les informations manquantes à compléter via un formulaire
 * Filtres supportés : clientId, startDate, endDate, search, onlyNotInvoiced, onlyInvoiced
 */
const getMovementsForInvoice = async (page, companyId, filters = {}) => {
  const limit = parseInt(process.env.limitByPage) || 10;
  const numbrePage = parseInt(page) || 1;

  const [movements, count, company] = await Promise.all([
    mouvmentRepository.findInvoiceableOutMovements(numbrePage, limit, companyId, filters),
    mouvmentRepository.countInvoiceableOutMovements(companyId, filters),
    companyRepository.findById(companyId),
  ]);

  const candidates = movements.map((movement) => buildInvoiceCandidate(movement, company));
  const pending = candidates.filter((candidate) => !candidate.has_invoice);

  return {
    movements: candidates,
    count,
    company: company
      ? {
          id: company.id,
          name: company.name,
          matriculeFiscale: company.matriculeFiscale,
          address: company.address,
          phone: company.phone,
        }
      : null,
    company_missing_fields: getCompanyMissingFields(company),
    summary: {
      total: count,
      pending: pending.length,
      ready: pending.filter((candidate) => candidate.readiness.is_ready).length,
      missing_info: pending.filter((candidate) => !candidate.readiness.is_complete).length,
      already_invoiced: candidates.filter((candidate) => candidate.has_invoice).length,
    },
  };
};

/**
 * Génère une facture depuis un mouvement OUT (vente)
 * options: { is_suspended, apply_rs, rs_rate, attestation_ref, purchase_order_ref,
 *            notes, payment_terms, clientId, client, company, allow_incomplete }
 */
const generateInvoiceFromMovement = async (movementId, companyId, options = {}) => {
  const movement = await mouvmentRepository.getById(movementId, companyId);
  if (!movement) {
    throw buildHttpError('Mouvement introuvable', 404);
  }

  if (movement.type !== 'OUT') {
    throw buildHttpError('Seules les sorties (ventes) peuvent générer une facture', 400);
  }

  if (movement.status === 'CANCELLED') {
    throw buildHttpError('Un mouvement annulé ne peut pas être facturé', 400);
  }

  const existing = await invoiceRepository.getInvoiceByMovementId(movementId, companyId);
  if (existing) {
    throw buildHttpError(`Une facture existe déjà pour ce mouvement : ${existing.reference}`, 409);
  }

  const isSuspended = options.is_suspended === true || options.is_suspended === 'true';
  const applyRs = options.apply_rs === true || options.apply_rs === 'true';
  const rsRate = parseFloat(options.rs_rate) || 1.0;

  if (isSuspended && !options.attestation_ref) {
    throw buildHttpError(
      "L'attestation fiscale est obligatoire pour une vente en suspension de TVA",
      400,
      {
        missing_fields: [
          {
            scope: 'invoice',
            field: 'attestation_ref',
            label: "Numéro d'attestation fiscale",
            required: true,
            message: "L'attestation fiscale est obligatoire pour une vente en suspension de TVA",
          },
        ],
      }
    );
  }

  // Complétion des informations manquantes via le formulaire
  const client = await resolveInvoiceClient(movement, companyId, options);
  const company = await completeCompany(companyId, options);
  const clientId = client?.id || null;

  const readiness = computeInvoiceReadiness({
    movement: { ...movement, clientId, items: movement.items },
    company,
    client,
  });

  const allowIncomplete = options.allow_incomplete === true || options.allow_incomplete === 'true';
  if (!readiness.is_ready && !allowIncomplete) {
    throw buildHttpError(
      'Informations manquantes pour générer la facture',
      400,
      { missing_fields: readiness.missing_fields }
    );
  }

  // Préparer les items avec tva_rate depuis le produit
  const items = movement.items.map((item) => ({
    unit_price: item.unit_price,
    quantity: item.quantity,
    tva_rate: item.product?.tva_rate ?? 19,
  }));

  const { total_ht, tva_breakdown, tva_amount, timbre_fiscal, total_ttc, rs_amount, net_payable } =
    calculateTotals(items, {
      is_suspended: isSuspended,
      apply_rs: applyRs,
      rs_rate: rsRate,
    });

  // Rattacher le client choisi au mouvement pour les prochaines générations
  if (clientId && movement.clientId !== clientId) {
    await mouvmentRepository.attachClient(movementId, clientId);
  }

  // Référence séquentielle légale
  const year = new Date().getFullYear();
  const lastNum = await invoiceRepository.getLastReferenceNumber(companyId, year, 'FAC');
  const reference = generateReference('FAC', lastNum + 1);

  return await invoiceRepository.createInvoice({
    reference,
    invoice_type: 'SALE',
    total_ht,
    tva_amount,
    tva_breakdown: JSON.stringify(tva_breakdown),
    timbre_fiscal,
    total_ttc,
    apply_rs: applyRs,
    rs_rate: rsRate,
    rs_amount,
    net_payable,
    is_suspended: isSuspended,
    attestation_ref: options.attestation_ref || null,
    purchase_order_ref: options.purchase_order_ref || null,
    notes: options.notes || movement.note || null,
    payment_terms: options.payment_terms || 'Paiement comptant',
    status: 'PENDING',
    movementId,
    clientId,
    companyId,
  });
};

/**
 * Génère une Facture d'Avoir (annulation de facture)
 */
const createCreditNote = async (originalInvoiceId, companyId, reason = '') => {
  const original = await invoiceRepository.getInvoiceById(originalInvoiceId, companyId);
  if (!original) {
    const err = new Error('Facture originale introuvable');
    err.statusCode = 404;
    throw err;
  }
  if (original.invoice_type === 'CREDIT_NOTE') {
    const err = new Error('Impossible de créer un avoir sur un avoir');
    err.statusCode = 400;
    throw err;
  }

  const year = new Date().getFullYear();
  const lastNum = await invoiceRepository.getLastReferenceNumber(companyId, year, 'AVO');
  const reference = generateReference('AVO', lastNum + 1);

  return await invoiceRepository.createInvoice({
    reference,
    invoice_type: 'CREDIT_NOTE',
    total_ht: -Math.abs(original.total_ht),
    tva_amount: -Math.abs(original.tva_amount),
    timbre_fiscal: 0, // Avoir : pas de timbre fiscal
    total_ttc: -Math.abs(original.total_ttc),
    rs_amount: 0,
    net_payable: -Math.abs(original.net_payable ?? original.total_ttc),
    tva_breakdown: original.tva_breakdown,
    original_invoice_id: originalInvoiceId,
    notes: reason || `Avoir sur facture ${original.reference}`,
    status: 'PENDING',
    movementId: original.movementId,
    clientId: original.clientId || null,
    companyId,
  });
};

/**
 * Données complètes pour le rendu PDF (Facture ou Avoir) selon la norme tunisienne
 */
const getInvoicePdfData = async (invoiceId, companyId) => {
  const invoice = await invoiceRepository.getInvoiceById(invoiceId, companyId);
  if (!invoice) throw new Error('Facture introuvable');

  const items =
    invoice.movement?.items?.map((item) => ({
      productName: item.product?.name || 'Produit',
      quantity: item.quantity,
      unitPriceHT: item.unit_price,
      tvaRate: item.product?.tva_rate ?? 19,
      totalLineHT: parseFloat((item.quantity * item.unit_price).toFixed(3)),
    })) || [];

  let tva_breakdown = [];
  if (invoice.tva_breakdown) {
    try {
      tva_breakdown = JSON.parse(invoice.tva_breakdown);
    } catch {
      tva_breakdown = [];
    }
  }

  // Si pas de tva_breakdown stocké (anciennes factures), calculer une ventilation par défaut
  if (tva_breakdown.length === 0 && invoice.total_ht > 0) {
    tva_breakdown = [
      {
        rate: 19,
        base_ht: invoice.total_ht,
        tva_amount: invoice.tva_amount,
      },
    ];
  }

  const payableAmount = invoice.net_payable ?? invoice.total_ttc;
  const amountInWords = amountToWords(payableAmount);

  return {
    company: {
      name: invoice.company?.name || 'Entreprise',
      matriculeFiscale: invoice.company?.matriculeFiscale || 'N/A',
      address: invoice.company?.address || 'N/A',
      phone: invoice.company?.phone || 'N/A',
    },
    client: invoice.client
      ? {
          name: invoice.client.name,
          matriculeFiscale: invoice.client.matriculeFiscale || 'N/A',
          phone: invoice.client.phone || 'N/A',
          address: invoice.client.address || 'N/A',
        }
      : null,
    invoiceDetails: {
      reference: invoice.reference,
      invoice_type: invoice.invoice_type || 'SALE',
      date: invoice.date,
      status: invoice.status,
      is_suspended: invoice.is_suspended || false,
      attestation_ref: invoice.attestation_ref,
      purchase_order_ref: invoice.purchase_order_ref,
      notes: invoice.notes,
      payment_terms: invoice.payment_terms,
      total_ht: invoice.total_ht,
      tva_amount: invoice.tva_amount,
      timbre_fiscal: invoice.timbre_fiscal,
      total_ttc: invoice.total_ttc,
      net_payable: invoice.net_payable ?? invoice.total_ttc,
    },
    fiscalSummary: {
      total_ht: invoice.total_ht,
      tva_breakdown,
      tva_amount: invoice.tva_amount,
      timbre_fiscal: invoice.timbre_fiscal,
      total_ttc: invoice.total_ttc,
      apply_rs: invoice.apply_rs || false,
      rs_rate: invoice.rs_rate || 1.0,
      rs_amount: invoice.rs_amount || 0,
      net_payable: payableAmount,
      amountInWords,
    },
    items,
  };
};

const getAllInvoices = async (page, companyId, filters = {}) => {
  const limit = parseInt(process.env.limitByPage) || 10;
  const numbrePage = parseInt(page) || 1;

  const invoices = await invoiceRepository.findPaginated(numbrePage, limit, companyId, filters);
  const count = await invoiceRepository.countAll(companyId, filters);

  return { invoices, count };
};

const updateInvoiceStatus = async (invoiceId, status, companyId) => {
  if (!['PENDING', 'PAID', 'CANCELLED'].includes(status)) {
    throw new Error('Statut invalide');
  }
  return await invoiceRepository.updateStatus(invoiceId, status, companyId);
};

module.exports = {
  getMovementsForInvoice,
  generateInvoiceFromMovement,
  createCreditNote,
  getInvoicePdfData,
  getAllInvoices,
  updateInvoiceStatus,
};
