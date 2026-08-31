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

// GET /api/mouvments/getAllMouvment?page=1&type=OUT&status=CONFIRMED&startDate=&endDate=
module.exports.getAllMouvment = async (req, res) => {
    try {
        const user = (req.session && req.session.user) ? req.session.user : req.user;
        const { numbrePage, page, type, status, startDate, endDate, clientId, supplierId } = req.query;

        const filters = {};
        if (type)       filters.type       = type;
        if (status)     filters.status     = status;
        if (startDate)  filters.startDate  = startDate;
        if (endDate)    filters.endDate    = endDate;
        if (clientId)   filters.clientId   = clientId;
        if (supplierId) filters.supplierId = supplierId;

        const result = await mouvmentService.getAllMouvments(page || numbrePage, user.companyId, filters);

        return res.status(200).json({
            success: true,
            message: "Mouvements récupérés avec succès",
            mouvments: result.mouvments,
            count: result.count
        });
    } catch (error) {
        console.error(error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
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
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

// GET /api/mouvments/:id
module.exports.getMouvmentById = async (req, res) => {
    try {
        const user = (req.session && req.session.user) ? req.session.user : req.user;
        const mouvment = await mouvmentService.getMouvmentById(req.params.id, user.companyId);
        return res.status(200).json({ success: true, mouvment });
    } catch (error) {
        console.error(error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

// GET /api/mouvments/getByClient/:clientId
module.exports.getMouvmentsByClient = async (req, res) => {
    try {
        const user = (req.session && req.session.user) ? req.session.user : req.user;
        const result = await mouvmentService.getMouvmentsByClient(req.params.clientId, user.companyId);
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

// GET /api/mouvments/getBySupplier/:supplierId
module.exports.getMouvmentsBySupplier = async (req, res) => {
    try {
        const user = (req.session && req.session.user) ? req.session.user : req.user;
        const result = await mouvmentService.getMouvmentsBySupplier(req.params.supplierId, user.companyId);
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};