const clientService = require('../services/clientService');

// POST /api/clients/createClient
module.exports.createClient = async (req, res) => {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        const client = await clientService.createClient(req.body, companyId);
        return res.status(201).json({ success: true, client });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { details: error.details }),
        });
    }
};

// PUT /api/clients/updateClient/:id
module.exports.updateClient = async (req, res) => {
    try {
        const id = req.params.id;
        const companyId = (req.user || req.session?.user)?.companyId;
        const client = await clientService.updateClient(id, req.body, companyId);
        // Correction : 200 pour un update (pas 201)
        return res.status(200).json({ success: true, client });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { details: error.details }),
        });
    }
};

// DELETE /api/clients/deleteClient/:id
module.exports.deleteClient = async (req, res) => {
    try {
        const id = req.params.id;
        const companyId = (req.user || req.session?.user)?.companyId;
        await clientService.deleteClient(id, companyId);
        // Correction : 200 avec body (204 n'envoie pas de corps de réponse)
        return res.status(200).json({ success: true, message: 'Client supprimé avec succès' });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { details: error.details }),
        });
    }
};

// GET /api/clients/getAllClients
// Correction : `_req` remplacé par `req` pour accéder à req.user
module.exports.getAllClients = async (req, res) => {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        const clients = await clientService.getAllClients(companyId);
        return res.status(200).json({ success: true, clients });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { details: error.details }),
        });
    }
};

// GET /api/clients/getClientByMatriculeFiscale/:mf
module.exports.getClientByMatriculeFiscale = async (req, res) => {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        const client = await clientService.getClientByMatriculeFiscale(req.params.mf, companyId);
        return res.status(200).json({ success: true, client });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { details: error.details }),
        });
    }
};

// GET /api/clients/searchClientsByName?name=...
module.exports.searchClientsByName = async (req, res) => {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        const clients = await clientService.searchClientsByName(req.query.name, companyId);
        return res.status(200).json({ success: true, clients });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { details: error.details }),
        });
    }
};

// GET /api/clients/:id
module.exports.getClientById = async (req, res) => {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        const client = await clientService.getClientByID(req.params.id, companyId);
        return res.status(200).json({ success: true, client });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
        });
    }
};