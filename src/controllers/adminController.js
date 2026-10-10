const adminService = require('../services/adminService');

// GET /api/admin/stats
module.exports.getPlatformStats = async (req, res) => {
  try {
    const stats = await adminService.getPlatformStats();
    return res.status(200).json({ success: true, stats });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/admin/companies?page=1&limit=20&search=
module.exports.getAllCompanies = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const result = await adminService.getAllCompanies({ page, limit, search });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/admin/companies/:id
module.exports.getCompanyDetails = async (req, res) => {
  try {
    const company = await adminService.getCompanyDetails(req.params.id);
    return res.status(200).json({ success: true, company });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message });
  }
};

// PUT /api/admin/companies/:id  — données générales uniquement (pas stock/produits)
module.exports.updateCompanyGeneralInfo = async (req, res) => {
  try {
    const company = await adminService.updateCompanyGeneralInfo(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      message: 'Informations générales de l\'entreprise mises à jour',
      company,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message });
  }
};

// PATCH /api/admin/companies/:id/status  { "is_active": true|false }
module.exports.toggleCompanyStatus = async (req, res) => {
  try {
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ success: false, message: 'is_active doit être un booléen' });
    }
    const company = await adminService.toggleCompanyStatus(req.params.id, is_active);
    const action = is_active ? 'réactivée' : 'suspendue';
    return res.status(200).json({ success: true, message: `Entreprise ${action} avec succès`, company });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message });
  }
};

// PATCH /api/admin/users/:id/status  { "is_active": true|false }
module.exports.toggleUserStatus = async (req, res) => {
  try {
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ success: false, message: 'is_active doit être un booléen' });
    }
    const user = await adminService.toggleUserStatus(req.params.id, is_active);
    const action = is_active ? 'réactivé' : 'suspendu';
    return res.status(200).json({ success: true, message: `Utilisateur ${action} avec succès`, user });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message });
  }
};
