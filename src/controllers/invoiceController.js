const invoiceService = require('../services/invoiceService');

// GET /api/invoices/getMovementsForInvoice
exports.getMovementsForInvoice = async (req, res) => {
  try {
    const user = req.session && req.session.user ? req.session.user : req.user;
    const {
      page,
      movementId,
      clientId,
      startDate,
      endDate,
      search,
      onlyNotInvoiced,
      onlyInvoiced,
    } = req.query;

    const filters = {};
    if (movementId) filters.movementId = movementId;
    if (clientId) filters.clientId = clientId;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (search) filters.search = search;
    if (onlyNotInvoiced === 'true') filters.onlyNotInvoiced = true;
    if (onlyInvoiced === 'true') filters.onlyInvoiced = true;

    const result = await invoiceService.getMovementsForInvoice(
      page || 1,
      user.companyId,
      filters
    );
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message });
  }
};

exports.generateInvoice = async (req, res) => {
  try {
    const user = req.session && req.session.user ? req.session.user : req.user;
    const {
      movementId,
      is_suspended,
      apply_rs,
      rs_rate,
      attestation_ref,
      purchase_order_ref,
      notes,
      payment_terms,
      clientId,
      client,
      company,
      allow_incomplete,
    } = req.body;

    if (!movementId) {
      return res.status(400).json({ success: false, message: 'movementId est requis' });
    }

    const invoice = await invoiceService.generateInvoiceFromMovement(
      movementId,
      user.companyId,
      {
        is_suspended: is_suspended === true || is_suspended === 'true',
        apply_rs: apply_rs === true || apply_rs === 'true',
        rs_rate: parseFloat(rs_rate) || 1.0,
        attestation_ref,
        purchase_order_ref,
        notes,
        payment_terms,
        clientId,
        client,
        company,
        allow_incomplete: allow_incomplete === true || allow_incomplete === 'true',
      }
    );
    return res.status(201).json({ success: true, message: 'Facture générée avec succès', invoice });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message,
      ...(error.details && { details: error.details }),
      ...(error.missing_fields && { missing_fields: error.missing_fields }),
    });
  }
};

exports.getInvoiceDataForPdf = async (req, res) => {
  try {
    const user = req.session && req.session.user ? req.session.user : req.user;
    const invoiceId = req.params.id;

    const data = await invoiceService.getInvoicePdfData(invoiceId, user.companyId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(404).json({ success: false, message: error.message });
  }
};

exports.getAllInvoices = async (req, res) => {
  try {
    const user = req.session && req.session.user ? req.session.user : req.user;
    const { page, status, clientId, startDate, endDate, invoice_type } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (clientId) filters.clientId = clientId;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (invoice_type) filters.invoice_type = invoice_type;

    const result = await invoiceService.getAllInvoices(page || 1, user.companyId, filters);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateInvoiceStatus = async (req, res) => {
  try {
    const user = req.session && req.session.user ? req.session.user : req.user;
    const invoiceId = req.params.id;
    const status = req.body.status;

    const updated = await invoiceService.updateInvoiceStatus(invoiceId, status, user.companyId);
    return res.status(200).json({ success: true, message: 'Statut mis à jour', invoice: updated });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.createCreditNote = async (req, res) => {
  try {
    const user = req.session && req.session.user ? req.session.user : req.user;
    const originalInvoiceId = req.params.id;
    const { reason } = req.body;

    const creditNote = await invoiceService.createCreditNote(
      originalInvoiceId,
      user.companyId,
      reason
    );
    return res.status(201).json({
      success: true,
      message: 'Facture d\'avoir créée avec succès',
      invoice: creditNote,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message });
  }
};
