const invoiceService = require('../services/invoiceService');

exports.generateInvoice = async (req, res) => {
    try {
        const user = (req.session && req.session.user) ? req.session.user : req.user;
        const movementId = req.body.movementId;
        if (!movementId) {
            return res.status(400).json({ success: false, message: "movementId est requis" });
        }
        
        const invoice = await invoiceService.generateInvoiceFromMovement(movementId, user.companyId);
        return res.status(201).json({ success: true, message: "Facture générée", invoice });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getInvoiceDataForPdf = async (req, res) => {
    try {
        const user = (req.session && req.session.user) ? req.session.user : req.user;
        const invoiceId = req.params.id;
        
        const data = await invoiceService.getInvoicePdfData(invoiceId, user.companyId);
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(404).json({ success: false, message: error.message });
    }
};

exports.getAllInvoices = async (req, res) => {
    try {
        const user = (req.session && req.session.user) ? req.session.user : req.user;
        const { page, status, clientId, startDate, endDate } = req.query;

        const filters = {};
        if (status)    filters.status    = status;
        if (clientId)  filters.clientId  = clientId;
        if (startDate) filters.startDate = startDate;
        if (endDate)   filters.endDate   = endDate;

        const result = await invoiceService.getAllInvoices(page || 1, user.companyId, filters);
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateInvoiceStatus = async (req, res) => {
    try {
        const user = (req.session && req.session.user) ? req.session.user : req.user;
        const invoiceId = req.params.id;
        const status = req.body.status;
        
        const updated = await invoiceService.updateInvoiceStatus(invoiceId, status, user.companyId);
        return res.status(200).json({ success: true, message: "Statut mis à jour", invoice: updated });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};
