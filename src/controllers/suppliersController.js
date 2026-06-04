// Contrôleur fournisseurs : gestion HTTP uniquement — tout accès direct au modèle supprimé, logique déléguée au supplierService.
const supplierService = require('../services/supplierService');

// POST /api/suppliers/addSuppliers
module.exports.addSuppliers = async function (req, res) {
    try {
        const supplier = await supplierService.addSupplier(req.body);
        return res.status(201).json({ success: true, suppliers: supplier });
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
        const supplier = await supplierService.updateSupplier(req.params.id, req.body);
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
        await supplierService.deleteSupplier(req.params.id);
        return res.status(200).json({ success: true, message: 'Fournisseur supprimé avec succès' });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

// GET /api/suppliers/getActiveSuppliers
module.exports.getActiveSuppliers = async function (_req, res) {
    try {
        const suppliers = await supplierService.getActiveSuppliers();
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
        await supplierService.deactivateSupplier(req.params.id);
        return res.status(200).json({ success: true, message: 'Fournisseur désactivé avec succès' });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

// GET /api/suppliers/searchSuppliersByName?name=...
module.exports.searchSuppliersByName = async function (req, res) {
    try {
        const suppliers = await supplierService.searchSuppliersByName(req.query.name);
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
module.exports.getAllSuppliers = async function (_req, res) {
    try {
        const suppliers = await supplierService.getAllSuppliers();
        if (suppliers.length === 0) {
            return res.status(404).json({ success: false, message: 'Aucun fournisseur trouvé' });
        }
        return res.status(200).json({ success: true, suppliers });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};
