const dashboardService = require('../services/dashboardService');

module.exports.getSummary = async (req, res) => {
    try {
        const user = (req.session && req.session.user) ? req.session.user : req.user;
        const summary = await dashboardService.getDashboardSummary(user.companyId);
        return res.status(200).json({ success: true, data: summary });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/dashboard/revenue?period=month|week|year
module.exports.getRevenue = async (req, res) => {
    try {
        const user = (req.session && req.session.user) ? req.session.user : req.user;
        const period = req.query.period || 'month';
        const data = await dashboardService.getDashboardRevenue(user.companyId, period);
        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/dashboard/topProducts
module.exports.getTopProducts = async (req, res) => {
    try {
        const user = (req.session && req.session.user) ? req.session.user : req.user;
        const products = await dashboardService.getTopProducts(user.companyId);
        return res.status(200).json({ success: true, products });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
