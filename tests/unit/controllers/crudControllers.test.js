jest.mock('../../../src/services/categorieService');
jest.mock('../../../src/services/clientService');
jest.mock('../../../src/services/supplierService');
const categorieService = require('../../../src/services/categorieService');
const clientService = require('../../../src/services/clientService');
const supplierService = require('../../../src/services/supplierService');
const categorieController = require('../../../src/controllers/categorieController');
const clientController = require('../../../src/controllers/clientController');
const suppliersController = require('../../../src/controllers/suppliersController');
const { mockReq, mockRes, httpError } = require('../helpers/http');

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

const body = { name: 'X' };

/**
 * [contrôleur, handler, service, fonction du service, requête,
 *  arguments attendus, résultat du service, statut, corps attendu]
 */
const cases = [
  // Catégories
  [
    categorieController,
    'createcategory',
    categorieService,
    'createCategory',
    { body },
    [body, 'c1'],
    { id: 'k1' },
    201,
    { success: true, categorie: { id: 'k1' } },
  ],
  [
    categorieController,
    'getAllCategories',
    categorieService,
    'getAllCategories',
    {},
    ['c1'],
    [],
    200,
    { success: true, categories: [] },
  ],
  [
    categorieController,
    'updateCategorie',
    categorieService,
    'updateCategory',
    { params: { id: 'k1' }, body },
    ['k1', body, 'c1'],
    { id: 'k1' },
    200,
    expect.objectContaining({ success: true, categorie: { id: 'k1' } }),
  ],
  [
    categorieController,
    'deleteCategorie',
    categorieService,
    'deleteCategory',
    { params: { id: 'k1' } },
    ['k1', 'c1'],
    undefined,
    200,
    expect.objectContaining({ success: true }),
  ],
  [
    categorieController,
    'getCategorieById',
    categorieService,
    'getCategoryById',
    { params: { id: 'k1' } },
    ['k1', 'c1'],
    { id: 'k1' },
    200,
    { success: true, categorie: { id: 'k1' } },
  ],
  [
    categorieController,
    'searchCategoriesByName',
    categorieService,
    'searchCategoriesByName',
    { query: { name: 'ép' } },
    ['ép', 'c1'],
    [{ id: 'k1' }],
    200,
    { success: true, count: 1, categories: [{ id: 'k1' }] },
  ],
  // Clients
  [
    clientController,
    'createClient',
    clientService,
    'createClient',
    { body },
    [body, 'c1'],
    { id: 'cl1' },
    201,
    { success: true, client: { id: 'cl1' } },
  ],
  [
    clientController,
    'updateClient',
    clientService,
    'updateClient',
    { params: { id: 'cl1' }, body },
    ['cl1', body, 'c1'],
    { id: 'cl1' },
    200,
    { success: true, client: { id: 'cl1' } },
  ],
  [
    clientController,
    'deleteClient',
    clientService,
    'deleteClient',
    { params: { id: 'cl1' } },
    ['cl1', 'c1'],
    undefined,
    200,
    expect.objectContaining({ success: true }),
  ],
  [
    clientController,
    'getAllClients',
    clientService,
    'getAllClients',
    {},
    ['c1'],
    [],
    200,
    { success: true, clients: [] },
  ],
  [
    clientController,
    'getClientByMatriculeFiscale',
    clientService,
    'getClientByMatriculeFiscale',
    { params: { mf: 'MF' } },
    ['MF', 'c1'],
    { id: 'cl1' },
    200,
    { success: true, client: { id: 'cl1' } },
  ],
  [
    clientController,
    'searchClientsByName',
    clientService,
    'searchClientsByName',
    { query: { name: 'me' } },
    ['me', 'c1'],
    [{ id: 'cl1' }],
    200,
    { success: true, clients: [{ id: 'cl1' }] },
  ],
  [
    clientController,
    'getClientById',
    clientService,
    'getClientByID',
    { params: { id: 'cl1' } },
    ['cl1', 'c1'],
    { id: 'cl1' },
    200,
    { success: true, client: { id: 'cl1' } },
  ],
  // Fournisseurs
  [
    suppliersController,
    'addSuppliers',
    supplierService,
    'addSupplier',
    { body },
    [body, 'c1'],
    { id: 's1' },
    201,
    { success: true, supplier: { id: 's1' } },
  ],
  [
    suppliersController,
    'updateSuppliers',
    supplierService,
    'updateSupplier',
    { params: { id: 's1' }, body },
    ['s1', body, 'c1'],
    { id: 's1' },
    200,
    { success: true, supplier: { id: 's1' } },
  ],
  [
    suppliersController,
    'deleteSuppliers',
    supplierService,
    'deleteSupplier',
    { params: { id: 's1' } },
    ['s1', 'c1'],
    undefined,
    200,
    expect.objectContaining({ success: true }),
  ],
  [
    suppliersController,
    'getActiveSuppliers',
    supplierService,
    'getActiveSuppliers',
    {},
    ['c1'],
    null,
    200,
    { success: true, suppliers: [] },
  ],
  [
    suppliersController,
    'updateSuppliersStatus',
    supplierService,
    'deactivateSupplier',
    { params: { id: 's1' } },
    ['s1', 'c1'],
    undefined,
    200,
    expect.objectContaining({ success: true }),
  ],
  [
    suppliersController,
    'activatedSuppliersStatus',
    supplierService,
    'activateSupplier',
    { params: { id: 's1' } },
    ['s1', 'c1'],
    undefined,
    200,
    expect.objectContaining({ success: true }),
  ],
  [
    suppliersController,
    'searchSuppliersByName',
    supplierService,
    'searchSuppliersByName',
    { query: { name: 'so' } },
    ['so', 'c1'],
    [{ id: 's1' }],
    200,
    { success: true, count: 1, suppliers: [{ id: 's1' }] },
  ],
  [
    suppliersController,
    'getAllSuppliers',
    supplierService,
    'getAllSuppliers',
    {},
    ['c1'],
    [{ id: 's1' }],
    200,
    { success: true, suppliers: [{ id: 's1' }] },
  ],
  [
    suppliersController,
    'getSupplierById',
    supplierService,
    'getSupplierById',
    { params: { id: 's1' } },
    ['s1', 'c1'],
    { id: 's1' },
    200,
    { success: true, supplier: { id: 's1' } },
  ],
];

describe.each(cases)(
  'contrôleurs CRUD',
  (controller, handler, service, serviceFn, req, args, result, status, expectedBody) => {
    describe(handler, () => {
      it(`appelle ${serviceFn} avec la société de l'utilisateur et renvoie ${status}`, async () => {
        service[serviceFn].mockResolvedValue(result);
        const res = mockRes();
        await controller[handler](mockReq(req), res);
        expect(service[serviceFn]).toHaveBeenCalledWith(...args);
        expect(res.status).toHaveBeenCalledWith(status);
        expect(res.json).toHaveBeenCalledWith(expectedBody);
      });

      it("propage le code HTTP de l'erreur métier", async () => {
        service[serviceFn].mockRejectedValue(httpError('Introuvable', 404));
        const res = mockRes();
        await controller[handler](mockReq(req), res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ success: false, message: 'Introuvable' })
        );
      });

      it('renvoie 500 pour une erreur inattendue', async () => {
        service[serviceFn].mockRejectedValue(new Error('boom'));
        const res = mockRes();
        await controller[handler](mockReq(req), res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  }
);

describe('détails de validation', () => {
  it.each([
    [categorieController.createcategory, categorieService, 'createCategory'],
    [categorieController.updateCategorie, categorieService, 'updateCategory'],
    [clientController.createClient, clientService, 'createClient'],
    [clientController.updateClient, clientService, 'updateClient'],
    [suppliersController.addSuppliers, supplierService, 'addSupplier'],
    [suppliersController.updateSuppliers, supplierService, 'updateSupplier'],
  ])('%# transmet error.details au client', async (handler, service, fn) => {
    service[fn].mockRejectedValue(
      httpError('Validation échouée', 400, { details: { name: 'requis' } })
    );
    const res = mockRes();
    await handler(mockReq({ params: { id: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ details: { name: 'requis' } }));
  });
});

describe('recherches sans résultat', () => {
  it('categorie : 404 quand aucune catégorie ne correspond', async () => {
    categorieService.searchCategoriesByName.mockResolvedValue([]);
    const res = mockRes();
    await categorieController.searchCategoriesByName(mockReq({ query: { name: 'z' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('fournisseur : 404 quand aucun fournisseur ne correspond', async () => {
    supplierService.searchSuppliersByName.mockResolvedValue([]);
    const res = mockRes();
    await suppliersController.searchSuppliersByName(mockReq({ query: { name: 'z' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('lit la société depuis la session quand req.user est absent', async () => {
    clientService.getAllClients.mockResolvedValue([]);
    await clientController.getAllClients(
      mockReq({ user: undefined, session: { user: { companyId: 'c9' } } }),
      mockRes()
    );
    expect(clientService.getAllClients).toHaveBeenCalledWith('c9');
  });
});
