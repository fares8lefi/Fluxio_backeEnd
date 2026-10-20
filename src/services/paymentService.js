const prisma = require('../../config/db');

const METHODS = ['CASH', 'CHECK', 'TRANSFER', 'BILL_OF_EXCHANGE', 'CARD'];
// Chèque et traite : le numéro est indispensable pour le suivi bancaire
const METHODS_REQUIRING_REFERENCE = ['CHECK', 'BILL_OF_EXCHANGE'];
const EPSILON = 0.0005; // demi-millime

const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

const httpError = (message, statusCode, details) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (details) err.details = details;
  return err;
};

/** Montant dû par le client : net à payer (après retenue à la source) ou TTC */
const amountDue = (invoice) => round3(invoice.net_payable ?? invoice.total_ttc);

/** Statut déduit du montant réglé */
const statusFor = (invoice, amountPaid) => {
  if (amountPaid <= EPSILON) return 'PENDING';
  return amountDue(invoice) - amountPaid <= EPSILON ? 'PAID' : 'PARTIALLY_PAID';
};

const summarize = (invoice, payments) => {
  const due = amountDue(invoice);
  const paid = round3(invoice.amount_paid);
  return {
    invoice: {
      id: invoice.id,
      reference: invoice.reference,
      status: invoice.status,
      amount_due: due,
      amount_paid: paid,
      remaining: round3(Math.max(due - paid, 0)),
    },
    payments,
  };
};

const loadInvoice = async (invoiceId, companyId, tx = prisma) => {
  const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, companyId } });
  if (!invoice) throw httpError('Facture introuvable', 404);
  return invoice;
};

/**
 * Enregistre un règlement et met à jour le statut de la facture
 * (en attente → partiellement payée → payée).
 * @param {{ amount, method, date?, reference?, note? }} data
 */
const addPayment = async (invoiceId, companyId, data = {}) => {
  const amount = round3(data.amount);
  const method = String(data.method || '').toUpperCase();
  const reference = typeof data.reference === 'string' ? data.reference.trim() : '';
  const date = data.date ? new Date(data.date) : new Date();

  const errors = {};
  if (!(amount > 0)) errors.amount = 'Le montant doit être supérieur à 0';
  if (!METHODS.includes(method)) errors.method = 'Mode de règlement invalide';
  if (METHODS_REQUIRING_REFERENCE.includes(method) && !reference)
    errors.reference =
      method === 'CHECK'
        ? 'Le numéro du chèque est obligatoire'
        : 'Le numéro de la traite est obligatoire';
  if (Number.isNaN(date.getTime())) errors.date = 'Date invalide';
  else if (date.getTime() > Date.now() + 24 * 60 * 60 * 1000)
    errors.date = 'La date ne peut pas être dans le futur';
  if (Object.keys(errors).length > 0) throw httpError('Règlement invalide', 400, errors);

  return prisma.$transaction(async (tx) => {
    const invoice = await loadInvoice(invoiceId, companyId, tx);
    if (invoice.invoice_type !== 'SALE')
      throw httpError('Seules les factures de vente reçoivent des règlements', 400);
    if (invoice.status === 'CANCELLED')
      throw httpError('Facture annulée : aucun règlement possible', 400);
    const creditNote = await tx.invoice.findFirst({
      where: { companyId, original_invoice_id: invoice.id, invoice_type: 'CREDIT_NOTE' },
      select: { reference: true },
    });
    if (creditNote)
      throw httpError(
        `Facture créditée par l'avoir ${creditNote.reference} : plus rien n'est dû`,
        409
      );

    const remaining = round3(amountDue(invoice) - invoice.amount_paid);
    if (remaining <= EPSILON) throw httpError('Cette facture est déjà entièrement réglée', 409);
    if (amount - remaining > EPSILON) {
      throw httpError(`Le montant dépasse le reste à payer (${remaining.toFixed(3)} TND)`, 400, {
        amount: `Maximum : ${remaining.toFixed(3)} TND`,
      });
    }

    await tx.payment.create({
      data: {
        amount,
        method,
        date,
        reference: reference || null,
        note: data.note?.trim() || null,
        invoiceId,
        companyId,
      },
    });

    const amountPaid = round3(invoice.amount_paid + amount);
    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: { amount_paid: amountPaid, status: statusFor(invoice, amountPaid) },
    });
    const payments = await tx.payment.findMany({ where: { invoiceId }, orderBy: { date: 'asc' } });
    return summarize(updated, payments);
  });
};

/** Règlements d'une facture + reste à payer */
const listPayments = async (invoiceId, companyId) => {
  const invoice = await loadInvoice(invoiceId, companyId);
  const payments = await prisma.payment.findMany({
    where: { invoiceId },
    orderBy: { date: 'asc' },
  });
  return summarize(invoice, payments);
};

/** Supprime un règlement saisi par erreur et recalcule le statut */
const deletePayment = async (paymentId, companyId) =>
  prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { id: paymentId, companyId } });
    if (!payment) throw httpError('Règlement introuvable', 404);
    const invoice = await loadInvoice(payment.invoiceId, companyId, tx);
    if (invoice.status === 'CANCELLED') throw httpError('Facture annulée : règlements figés', 400);

    await tx.payment.delete({ where: { id: paymentId } });
    const amountPaid = round3(Math.max(invoice.amount_paid - payment.amount, 0));
    const updated = await tx.invoice.update({
      where: { id: invoice.id },
      data: { amount_paid: amountPaid, status: statusFor(invoice, amountPaid) },
    });
    const payments = await tx.payment.findMany({
      where: { invoiceId: invoice.id },
      orderBy: { date: 'asc' },
    });
    return summarize(updated, payments);
  });

module.exports = { addPayment, listPayments, deletePayment, statusFor, amountDue, METHODS };
