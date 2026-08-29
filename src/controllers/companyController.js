const companyService = require('../services/companyService');

// GET /api/company/my-company
module.exports.getMyCompany = async (req, res) => {
    try {
        const user = (req.session && req.session.user) ? req.session.user : req.user;
        const company = await companyService.getMyCompany(user.companyId);
        return res.status(200).json({ success: true, company });
    } catch (error) {
        console.error(error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

// PUT /api/company/update
module.exports.updateMyCompany = async (req, res) => {
    try {
        const user = (req.session && req.session.user) ? req.session.user : req.user;
        const updated = await companyService.updateMyCompany(user.companyId, req.body);
        return res.status(200).json({ 
            success: true, 
            message: "Entreprise mise à jour avec succès", 
            company: updated 
        });
    } catch (error) {
        console.error(error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};
