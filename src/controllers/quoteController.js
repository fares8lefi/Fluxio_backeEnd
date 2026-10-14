const quoteService = require('../services/quoteService');

exports.createQuote = async (req, res) => {
  try {
    const user = req.session && req.session.user ? req.session.user : req.user;
    const quote = await quoteService.createQuote(req.body, user.companyId);
    return res.status(201).json({ success: true, message: 'Devis créé avec succès', quote });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.getAllQuotes = async (req, res) => {
  try {
    const user = req.session && req.session.user ? req.session.user : req.user;
    const { status, clientId } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (clientId) filters.clientId = clientId;

    const quotes = await quoteService.getAll(user.companyId, filters);
    return res.status(200).json({ success: true, quotes, count: quotes.length });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getQuoteById = async (req, res) => {
  try {
    const user = req.session && req.session.user ? req.session.user : req.user;
    const quote = await quoteService.getById(req.params.id, user.companyId);
    return res.status(200).json({ success: true, quote });
  } catch (error) {
    return res.status(404).json({ success: false, message: error.message });
  }
};

exports.updateQuoteStatus = async (req, res) => {
  try {
    const user = req.session && req.session.user ? req.session.user : req.user;
    const updated = await quoteService.updateStatus(req.params.id, req.body.status, user.companyId);
    return res.status(200).json({ success: true, quote: updated });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// POST /api/quotes/:id/convert — devis accepté → sortie de stock + facture
exports.convertQuote = async (req, res) => {
  try {
    const user = req.session && req.session.user ? req.session.user : req.user;
    const result = await quoteService.convertToInvoice(req.params.id, user, req.body || {});
    return res.status(201).json({
      success: true,
      message: `Facture ${result.invoice.reference} créée à partir du devis`,
      ...result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      ...(error.missing_fields && { missing_fields: error.missing_fields }),
      ...(error.details && { errors: error.details }),
    });
  }
};
