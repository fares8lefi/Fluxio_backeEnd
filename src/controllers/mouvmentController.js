const mouvmentService = require('../services/mouvmentService');

// POST /api/mouvments/createMouvment
module.exports.createMouvment = async (req, res) => {
    try {
        const user = (req.session && req.session.user) ? req.session.user : req.user;
        const mouvment = await mouvmentService.createMouvment(req.body, user);
        
        return res.status(201).json({ 
            success: true, 
            message: "Mouvment created successfully", 
            mouvment 
        });
    } catch (error) {
        console.error(error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { details: error.details }),
        });
    }
};

// GET /api/mouvments/getAllMouvment
module.exports.getAllMouvment = async (req, res) => {
    try {
        const { numbrePage } = req.query;
        const user = (req.session && req.session.user) ? req.session.user : req.user;
        const result = await mouvmentService.getAllMouvments(numbrePage, user.companyId);
        
        return res.status(200).json({ 
            success: true, 
            message: "Mouvments fetched successfully", 
            mouvments: result.mouvments,
            count: result.count 
        });
    } catch (error) {
        console.error(error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// PUT /api/mouvments/cancel/:id
module.exports.cancelMouvment = async (req, res) => {
    try {
        const user = (req.session && req.session.user) ? req.session.user : req.user;
        const mouvmentId = req.params.id;
        
        const result = await mouvmentService.cancelMouvment(mouvmentId, user.companyId);
        
        return res.status(200).json({ 
            success: true, 
            message: "Mouvement annulé avec succès", 
            mouvment: result 
        });
    } catch (error) {
        console.error(error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ 
            success: false, 
            message: error.message 
        });
    }
};