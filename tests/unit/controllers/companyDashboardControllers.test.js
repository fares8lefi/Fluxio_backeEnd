jest.mock('../../../src/services/companyService');
jest.mock('../../../src/services/dashboardService');
const companyService = require('../../../src/services/companyService');
const dashboardService = require('../../../src/services/dashboardService');
const companyController = require('../../../src/controllers/companyController');
const dashboardController = require('../../../src/controllers/dashboardController');
const { mockReq, mockRes, httpError } = require('../helpers/http');

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('companyController', () => {
  it("getMyCompany renvoie l'entreprise de l'utilisateur de session", async () => {
    companyService.getMyCompany.mockResolvedValueOnce({ id: 'c2' });
    const res = mockRes();
    await companyController.getMyCompany(mockReq({ session: { user: { companyId: 'c2' } } }), res);
    expect(companyService.getMyCompany).toHaveBeenCalledWith('c2');
    expect(res.json).toHaveBeenCalledWith({ success: true, company: { id: 'c2' } });
  });

  it('getMyCompany propage le 404', async () => {
    companyService.getMyCompany.mockRejectedValueOnce(httpError('Entreprise introuvable', 404));
    const res = mockRes();
    await companyController.getMyCompany(mockReq(), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('updateMyCompany met à jour ou renvoie les erreurs par champ', async () => {
    companyService.updateMyCompany.mockResolvedValueOnce({ id: 'c1', phone: '71' });
    let res = mockRes();
    await companyController.updateMyCompany(mockReq({ body: { phone: '71' } }), res);
    expect(companyService.updateMyCompany).toHaveBeenCalledWith('c1', { phone: '71' });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ company: { id: 'c1', phone: '71' } })
    );

    companyService.updateMyCompany.mockRejectedValueOnce(
      httpError('Données entreprise invalides', 400, { details: { phone: 'invalide' } })
    );
    res = mockRes();
    await companyController.updateMyCompany(mockReq({ body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: { phone: 'invalide' } })
    );

    companyService.updateMyCompany.mockRejectedValueOnce(new Error('db'));
    res = mockRes();
    await companyController.updateMyCompany(mockReq(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('dashboardController', () => {
  it.each([
    ['getSummary', 'getDashboardSummary', {}, ['c1'], 'data'],
    ['getRevenue', 'getDashboardRevenue', { query: { period: 'year' } }, ['c1', 'year'], 'data'],
    ['getRevenue', 'getDashboardRevenue', {}, ['c1', 'month'], 'data'],
    ['getTopProducts', 'getTopProducts', {}, ['c1'], 'products'],
    ['getStockHealth', 'getStockHealth', {}, ['c1'], 'data'],
    [
      'getStockHistory',
      'getStockHistory',
      { query: { productId: 'p1', days: '7' } },
      ['c1', 'p1', '7'],
      'data',
    ],
  ])('%s → dashboardService.%s', async (handler, serviceFn, req, args, key) => {
    dashboardService[serviceFn].mockResolvedValueOnce({ ok: 1 });
    let res = mockRes();
    await dashboardController[handler](mockReq(req), res);
    expect(dashboardService[serviceFn]).toHaveBeenCalledWith(...args);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, [key]: { ok: 1 } });

    dashboardService[serviceFn].mockRejectedValueOnce(new Error('db'));
    res = mockRes();
    await dashboardController[handler](mockReq(req), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
