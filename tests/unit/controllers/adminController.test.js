jest.mock('../../../src/services/adminService');
jest.mock('../../../src/services/adminKpiService');
jest.mock('../../../src/services/managerService');
const adminService = require('../../../src/services/adminService');
const adminKpiService = require('../../../src/services/adminKpiService');
const managerService = require('../../../src/services/managerService');
const adminController = require('../../../src/controllers/adminController');
const { mockReq, mockRes, httpError } = require('../helpers/http');

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

const call = async (handler, req) => {
  const res = mockRes();
  await adminController[handler](mockReq(req), res);
  return res;
};

describe('adminController', () => {
  it('getPlatformStats renvoie les stats ou 500', async () => {
    adminService.getPlatformStats.mockResolvedValueOnce({ totalCompanies: 3 });
    let res = await call('getPlatformStats', {});
    expect(res.json).toHaveBeenCalledWith({ success: true, stats: { totalCompanies: 3 } });

    adminService.getPlatformStats.mockRejectedValueOnce(new Error('db'));
    res = await call('getPlatformStats', {});
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('getAllCompanies convertit la pagination et applique les valeurs par défaut', async () => {
    adminService.getAllCompanies.mockResolvedValue({ companies: [], total: 0 });
    await call('getAllCompanies', { query: { page: '2', limit: '5', search: 'atl' } });
    expect(adminService.getAllCompanies).toHaveBeenCalledWith({ page: 2, limit: 5, search: 'atl' });

    const res = await call('getAllCompanies', {});
    expect(adminService.getAllCompanies).toHaveBeenLastCalledWith({
      page: 1,
      limit: 20,
      search: '',
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, companies: [], total: 0 });

    adminService.getAllCompanies.mockRejectedValueOnce(new Error('db'));
    expect((await call('getAllCompanies', {})).status).toHaveBeenCalledWith(500);
  });

  it.each([
    ['getCompanyDetails', 'getCompanyDetails', { params: { id: 'c1' } }, ['c1'], 'company'],
    [
      'updateCompanyGeneralInfo',
      'updateCompanyGeneralInfo',
      { params: { id: 'c1' }, body: { name: 'A' } },
      ['c1', { name: 'A' }],
      'company',
    ],
  ])('%s', async (handler, serviceFn, req, args, key) => {
    adminService[serviceFn].mockResolvedValueOnce({ id: 'c1' });
    let res = await call(handler, req);
    expect(adminService[serviceFn]).toHaveBeenCalledWith(...args);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ [key]: { id: 'c1' } }));

    adminService[serviceFn].mockRejectedValueOnce(httpError('Entreprise introuvable', 404));
    res = await call(handler, req);
    expect(res.status).toHaveBeenCalledWith(404);

    adminService[serviceFn].mockRejectedValueOnce(new Error('db'));
    res = await call(handler, req);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  describe.each([
    ['toggleCompanyStatus', 'toggleCompanyStatus', 'company', 'Entreprise'],
    ['toggleUserStatus', 'toggleUserStatus', 'user', 'Utilisateur'],
  ])('%s', (handler, serviceFn, key, label) => {
    it('exige un booléen', async () => {
      const res = await call(handler, { params: { id: 'x1' }, body: { is_active: 'true' } });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(adminService[serviceFn]).not.toHaveBeenCalled();
    });

    it.each([
      [true, 'réactivé'],
      [false, 'suspendu'],
    ])('is_active=%s → message « %s »', async (is_active, word) => {
      adminService[serviceFn].mockResolvedValueOnce({ id: 'x1' });
      const res = await call(handler, { params: { id: 'x1' }, body: { is_active } });
      expect(adminService[serviceFn]).toHaveBeenCalledWith('x1', is_active);
      const payload = res.json.mock.calls[0][0];
      expect(payload[key]).toEqual({ id: 'x1' });
      expect(payload.message).toMatch(new RegExp(`^${label} ${word}`));
    });

    it("propage l'erreur du service", async () => {
      adminService[serviceFn].mockRejectedValueOnce(httpError('introuvable', 404));
      let res = await call(handler, { params: { id: 'x1' }, body: { is_active: true } });
      expect(res.status).toHaveBeenCalledWith(404);
      adminService[serviceFn].mockRejectedValueOnce(new Error('db'));
      res = await call(handler, { params: { id: 'x1' }, body: { is_active: true } });
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('indicateurs', () => {
    it.each([
      ['getKpiOverview', 'getOverview', true],
      ['getKpiTrend', 'getTrend', true],
      ['getKpiTopCompanies', 'getTopCompanies', true],
      ['getKpiHealth', 'getHealth', false],
    ])('%s renvoie les données', async (handler, serviceFn, withQuery) => {
      adminKpiService[serviceFn].mockResolvedValueOnce({ ok: 1 });
      const res = await call(handler, { query: { period: 'month' } });
      if (withQuery) expect(adminKpiService[serviceFn]).toHaveBeenCalledWith({ period: 'month' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { ok: 1 } });
    });

    it('remonte les erreurs 4xx et masque le détail des 500', async () => {
      adminKpiService.getOverview.mockRejectedValueOnce(httpError('Période invalide', 400));
      let res = await call('getKpiOverview', {});
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Période invalide' });

      adminKpiService.getOverview.mockRejectedValueOnce(new Error('SQL secret'));
      res = await call('getKpiOverview', {});
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Impossible de calculer les indicateurs',
      });
    });

    it("getCompanyKpis vérifie l'entreprise puis renvoie ses KPI", async () => {
      adminService.getCompanyDetails.mockResolvedValueOnce({ id: 'c7' });
      managerService.getManagerKpis.mockResolvedValueOnce({ kpis: [] });
      let res = await call('getCompanyKpis', { params: { id: 'c7' }, query: { period: '30d' } });
      expect(managerService.getManagerKpis).toHaveBeenCalledWith('c7', { period: '30d' });
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { kpis: [] } });

      adminService.getCompanyDetails.mockRejectedValueOnce(
        httpError('Entreprise introuvable', 404)
      );
      res = await call('getCompanyKpis', { params: { id: 'zz' } });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(managerService.getManagerKpis).toHaveBeenCalledTimes(1);
    });
  });

  it('createAdmin renvoie 201, les erreurs de validation ou 500', async () => {
    const admin = { id: 'a1', email: 'ops@fluxio.tn', role: 'admin' };
    adminService.createAdmin.mockResolvedValueOnce(admin);
    let res = await call('createAdmin', { body: { email: 'ops@fluxio.tn' } });
    expect(adminService.createAdmin).toHaveBeenCalledWith(
      { email: 'ops@fluxio.tn' },
      expect.objectContaining({ id: 'u1' })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Administrateur créé : un code d'activation a été envoyé à ops@fluxio.tn",
      admin,
    });

    adminService.createAdmin.mockRejectedValueOnce(
      httpError('Validation échouée', 400, { details: { email: 'Email is invalid' } })
    );
    res = await call('createAdmin', {});
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation échouée',
      errors: { email: 'Email is invalid' },
    });

    adminService.createAdmin.mockRejectedValueOnce(new Error('db'));
    res = await call('createAdmin', {});
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
