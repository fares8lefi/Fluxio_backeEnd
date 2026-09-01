// Contrôleur fournisseurs : gestion HTTP uniquement — logique déléguée au supplierService.
const supplierService = require('../services/supplierService');

// POST /api/suppliers/addSuppliers
module.exports.addSuppliers = async function (req, res) {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        const supplier = await supplierService.addSupplier(req.body, companyId);
        return res.status(201).json({ success: true, supplier });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { details: error.details }),
        });
    }
};

// PUT /api/suppliers/updateSuppliers/:id
module.exports.updateSuppliers = async function (req, res) {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        const supplier = await supplierService.updateSupplier(req.params.id, req.body, companyId);
        return res.status(200).json({ success: true, supplier });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { details: error.details }),
        });
    }
};

// DELETE /api/suppliers/deleteSuppliers/:id
module.exports.deleteSuppliers = async function (req, res) {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        await supplierService.deleteSupplier(req.params.id, companyId);
        return res.status(200).json({ success: true, message: 'Fournisseur supprimé avec succès' });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

// GET /api/suppliers/getActiveSuppliers
// Correction : `_req` remplacé par `req` pour accéder à req.user
module.exports.getActiveSuppliers = async function (req, res) {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        const suppliers = await supplierService.getActiveSuppliers(companyId);
        if (suppliers.length === 0) {
            return res.status(404).json({ success: false, message: 'Aucun fournisseur actif trouvé' });
        }
        return res.status(200).json({ success: true, suppliers });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

// PATCH /api/suppliers/updateSuppliersStatus/:id
module.exports.updateSuppliersStatus = async function (req, res) {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        await supplierService.deactivateSupplier(req.params.id, companyId);
        return res.status(200).json({ success: true, message: 'Fournisseur désactivé avec succès' });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

// GET /api/suppliers/searchSuppliersByName?name=...
module.exports.searchSuppliersByName = async function (req, res) {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        const suppliers = await supplierService.searchSuppliersByName(req.query.name, companyId);
        if (suppliers.length === 0) {
            return res.status(404).json({ success: false, message: 'Aucun fournisseur trouvé avec ce nom' });
        }
        return res.status(200).json({ success: true, count: suppliers.length, suppliers });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

// GET /api/suppliers/getAllSuppliers
// Correction : `_req` remplacé par `req` pour accéder à req.user
module.exports.getAllSuppliers = async function (req, res) {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        const suppliers = await supplierService.getAllSuppliers(companyId);
        if (suppliers.length === 0) {
            return res.status(404).json({ success: false, message: 'Aucun fournisseur trouvé' });
        }
        return res.status(200).json({ success: true, suppliers });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

// GET /api/suppliers/:id
module.exports.getSupplierById = async function (req, res) {
    try {
        const companyId = (req.user || req.session?.user)?.companyId;
        const supplier = await supplierService.getSupplierById(req.params.id, companyId);
        return res.status(200).json({ success: true, supplier });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};
