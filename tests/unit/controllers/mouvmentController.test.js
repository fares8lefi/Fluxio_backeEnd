jest.mock('../../../src/services/mouvmentService');
jest.mock('../../../src/services/inventoryService');
const mouvmentService = require('../../../src/services/mouvmentService');
const inventoryService = require('../../../src/services/inventoryService');
const mouvmentController = require('../../../src/controllers/mouvmentController');
const { mockReq, mockRes, httpError } = require('../helpers/http');

const user = { id: 'u1', companyId: 'c1', role: 'user' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

const call = async (handler, req) => {
  const res = mockRes();
  await mouvmentController[handler](mockReq(req), res);
  return res;
};

describe('mouvmentController', () => {
  it('createMouvment transmet le corps et l’utilisateur de session', async () => {
    mouvmentService.createMouvment.mockResolvedValueOnce({ id: 'm1' });
    const sessionUser = { id: 'u2', companyId: 'c2' };
    let res = await call('createMouvment', {
      body: { type: 'IN' },
      session: { user: sessionUser },
    });
    expect(mouvmentService.createMouvment).toHaveBeenCalledWith({ type: 'IN' }, sessionUser);
    expect(res.status).toHaveBeenCalledWith(201);

    mouvmentService.createMouvment.mockRejectedValueOnce(
      httpError('Validation échouée', 400, { details: { items: 'requis' } })
    );
    res = await call('createMouvment', {});
    expect(mouvmentService.createMouvment).toHaveBeenLastCalledWith({}, user);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ details: { items: 'requis' } })
    );
  });

  describe('getAllMouvment', () => {
    it('ne transmet que les filtres renseignés', async () => {
      mouvmentService.getAllMouvments.mockResolvedValue({ mouvments: [{ id: 'm1' }], count: 1 });
      const res = await call('getAllMouvment', {
        query: {
          page: '2',
          limit: '5',
          type: 'OUT',
          status: 'CONFIRMED',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          clientId: 'k1',
          supplierId: 's1',
          ignored: 'x',
        },
      });
      expect(mouvmentService.getAllMouvments).toHaveBeenCalledWith(
        '2',
        'c1',
        {
          type: 'OUT',
          status: 'CONFIRMED',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          clientId: 'k1',
          supplierId: 's1',
        },
        '5'
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ mouvments: [{ id: 'm1' }], count: 1 })
      );
    });

    it('accepte numbrePage et propage les erreurs', async () => {
      mouvmentService.getAllMouvments.mockResolvedValueOnce({ mouvments: [], count: 0 });
      await call('getAllMouvment', { query: { numbrePage: '3' } });
      expect(mouvmentService.getAllMouvments).toHaveBeenCalledWith('3', 'c1', {}, undefined);

      mouvmentService.getAllMouvments.mockRejectedValueOnce(new Error('db'));
      const res = await call('getAllMouvment', {});
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  it.each([
    [
      'cancelMouvment',
      'cancelMouvment',
      { params: { id: 'm1' } },
      ['m1', 'c1'],
      { id: 'm1' },
      'mouvment',
    ],
    [
      'getMouvmentById',
      'getMouvmentById',
      { params: { id: 'm1' } },
      ['m1', 'c1'],
      { id: 'm1' },
      'mouvment',
    ],
  ])('%s', async (handler, serviceFn, req, args, result, key) => {
    mouvmentService[serviceFn].mockResolvedValueOnce(result);
    let res = await call(handler, req);
    expect(mouvmentService[serviceFn]).toHaveBeenCalledWith(...args);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ [key]: result }));

    mouvmentService[serviceFn].mockRejectedValueOnce(httpError('Mouvement introuvable', 404));
    res = await call(handler, req);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it.each([
    ['getMouvmentsByClient', { params: { clientId: 'k1' } }, 'k1'],
    ['getMouvmentsBySupplier', { params: { supplierId: 's1' } }, 's1'],
  ])('%s fusionne le résultat dans la réponse', async (handler, req, id) => {
    mouvmentService[handler].mockResolvedValueOnce({ mouvments: [], count: 0 });
    let res = await call(handler, req);
    expect(mouvmentService[handler]).toHaveBeenCalledWith(id, 'c1');
    expect(res.json).toHaveBeenCalledWith({ success: true, mouvments: [], count: 0 });

    mouvmentService[handler].mockRejectedValueOnce(httpError('requis', 400));
    res = await call(handler, req);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  describe('adjustStock', () => {
    it('résume le nombre de produits ajustés', async () => {
      inventoryService.applyAdjustment.mockResolvedValueOnce({
        adjusted: 2,
        movement: { id: 'm1' },
      });
      let res = await call('adjustStock', { body: { reason: 'INVENTORY' } });
      expect(inventoryService.applyAdjustment).toHaveBeenCalledWith(user, { reason: 'INVENTORY' });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: '2 produit(s) ajusté(s)', adjusted: 2 })
      );

      inventoryService.applyAdjustment.mockResolvedValueOnce({ adjusted: 0 });
      res = await call('adjustStock', {});
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Aucun écart : stock inchangé' })
      );
    });

    it('renvoie les erreurs ligne par ligne', async () => {
      inventoryService.applyAdjustment.mockRejectedValueOnce(
        httpError('Ajustement invalide', 400, { details: [{ line: 1 }] })
      );
      let res = await call('adjustStock', {});
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errors: [{ line: 1 }] }));

      inventoryService.applyAdjustment.mockRejectedValueOnce(new Error('db'));
      res = await call('adjustStock', {});
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
