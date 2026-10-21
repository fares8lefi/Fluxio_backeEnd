const adminService = require('../services/adminService');
const adminKpiService = require('../services/adminKpiService');
const managerService = require('../services/managerService');

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
      message: "Informations générales de l'entreprise mises à jour",
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
    return res
      .status(200)
      .json({ success: true, message: `Entreprise ${action} avec succès`, company });
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
    return res
      .status(200)
      .json({ success: true, message: `Utilisateur ${action} avec succès`, user });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message });
  }
};

// POST /api/admin/admins  { username, email, password, phone? }
module.exports.createAdmin = async (req, res) => {
  try {
    const admin = await adminService.createAdmin(req.body, req.user);
    return res.status(201).json({
      success: true,
      message: `Administrateur créé : un code d'activation a été envoyé à ${admin.email}`,
      admin,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode === 500) console.error(error);
    return res.status(statusCode).json({
      success: false,
      message: error.message,
      ...(error.details && { errors: error.details }),
    });
  }
};

// ─── Indicateurs (KPI) de la plateforme ─────────────────────────────────────
/** Enveloppe commune : erreurs 4xx remontées, détail technique des 500 masqué */
const handleKpi = (name, loader) => async (req, res) => {
  try {
    const data = await loader(req);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode === 500) {
      console.error(`[admin:kpi:${name}]`, error);
      return res
        .status(500)
        .json({ success: false, message: 'Impossible de calculer les indicateurs' });
    }
    return res.status(statusCode).json({ success: false, message: error.message });
  }
};

// GET /api/admin/kpis/overview?period=month|30d|prev_month|year|custom
module.exports.getKpiOverview = handleKpi('overview', (req) =>
  adminKpiService.getOverview(req.query)
);

// GET /api/admin/kpis/trend?months=12
module.exports.getKpiTrend = handleKpi('trend', (req) => adminKpiService.getTrend(req.query));

// GET /api/admin/kpis/top-companies?by=revenue|invoices|movements|users&limit=10&period=
module.exports.getKpiTopCompanies = handleKpi('top-companies', (req) =>
  adminKpiService.getTopCompanies(req.query)
);

// GET /api/admin/kpis/health
module.exports.getKpiHealth = handleKpi('health', () => adminKpiService.getHealth());

// GET /api/admin/companies/:id/kpis?period=  — mêmes KPI que la page « Pilotage »
module.exports.getCompanyKpis = handleKpi('company', async (req) => {
  await adminService.getCompanyDetails(req.params.id); // 404 si inexistante
  return managerService.getManagerKpis(req.params.id, req.query);
});
