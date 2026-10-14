const paymentService = require('../services/paymentService');

const currentUser = (req) => (req.session && req.session.user ? req.session.user : req.user);

const fail = (res, error) =>
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message,
    ...(error.details && { errors: error.details }),
  });

// GET /api/invoices/:id/payments
exports.listPayments = async (req, res) => {
  try {
    const result = await paymentService.listPayments(req.params.id, currentUser(req).companyId);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return fail(res, error);
  }
};

// POST /api/invoices/:id/payments
exports.addPayment = async (req, res) => {
  try {
    const result = await paymentService.addPayment(
      req.params.id,
      currentUser(req).companyId,
      req.body
    );
    return res.status(201).json({ success: true, message: 'Règlement enregistré', ...result });
  } catch (error) {
    return fail(res, error);
  }
};

// DELETE /api/invoices/payments/:paymentId
exports.deletePayment = async (req, res) => {
  try {
    const result = await paymentService.deletePayment(
      req.params.paymentId,
      currentUser(req).companyId
    );
    return res.status(200).json({ success: true, message: 'Règlement supprimé', ...result });
  } catch (error) {
    return fail(res, error);
  }
};
