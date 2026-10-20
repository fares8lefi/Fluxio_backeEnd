jest.mock('../../../src/services/productService');
const productService = require('../../../src/services/productService');
const productController = require('../../../src/controllers/productController');
const { mockReq, mockRes, httpError } = require('../helpers/http');

beforeEach(() => jest.clearAllMocks());

const call = async (handler, req) => {
  const res = mockRes();
  await productController[handler](mockReq(req), res);
  return res;
};

describe('productController', () => {
  it('addProduct crée le produit (201) ou renvoie les erreurs de validation', async () => {
    productService.addProduct.mockResolvedValueOnce({ id: 'p1' });
    let res = await call('addProduct', { body: { name: 'Huile' } });
    expect(productService.addProduct).toHaveBeenCalledWith({ name: 'Huile' }, 'c1');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ product: { id: 'p1' } }));

    productService.addProduct.mockRejectedValueOnce(
      httpError('Validation', 400, { details: { name: 'x' } })
    );
    res = await call('addProduct', {});
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ details: { name: 'x' } }));
  });

  it('deleteProduct supprime ou propage le 404', async () => {
    productService.deleteProduct.mockResolvedValueOnce();
    let res = await call('deleteProduct', { params: { id: 'p1' } });
    expect(productService.deleteProduct).toHaveBeenCalledWith('p1', 'c1');
    expect(res.status).toHaveBeenCalledWith(200);

    productService.deleteProduct.mockRejectedValueOnce(httpError('Produit introuvable', 404));
    res = await call('deleteProduct', { params: { id: 'p1' } });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  describe('getAllProduct', () => {
    it('pagine avec les valeurs de requête', async () => {
      productService.getAllProductsPaginated.mockResolvedValue({
        products: [{ id: 'p1' }],
        total: 21,
      });
      const res = await call('getAllProduct', { query: { page: '2', limit: '10' } });
      expect(productService.getAllProductsPaginated).toHaveBeenCalledWith(2, 10, 'c1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        products: [{ id: 'p1' }],
        pagination: { total: 21, page: 2, pages: 3 },
      });
    });

    it('renvoie 404 sans produit et 500 en cas d’erreur', async () => {
      productService.getAllProductsPaginated.mockResolvedValueOnce({ products: [], total: 0 });
      let res = await call('getAllProduct', {});
      expect(productService.getAllProductsPaginated).toHaveBeenCalledWith(1, 10, 'c1');
      expect(res.status).toHaveBeenCalledWith(404);

      productService.getAllProductsPaginated.mockRejectedValueOnce(new Error('db'));
      res = await call('getAllProduct', {});
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateProduct', () => {
    it('refuse des données invalides sans appeler le service', async () => {
      const res = await call('updateProduct', { params: { id: 'p1' }, body: { tva_rate: 5 } });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(productService.updateProduct).not.toHaveBeenCalled();
    });

    it('met à jour le produit ou propage l’erreur', async () => {
      productService.updateProduct.mockResolvedValueOnce({ id: 'p1' });
      let res = await call('updateProduct', { params: { id: 'p1' }, body: { name: 'N' } });
      expect(productService.updateProduct).toHaveBeenCalledWith('p1', { name: 'N' }, 'c1');
      expect(res.status).toHaveBeenCalledWith(200);

      productService.updateProduct.mockRejectedValueOnce(httpError('Produit introuvable', 404));
      res = await call('updateProduct', { params: { id: 'p1' }, body: {} });
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  it('getProductById renvoie le produit ou l’erreur', async () => {
    productService.getProductById.mockResolvedValueOnce({ id: 'p1' });
    let res = await call('getProductById', { params: { id: 'p1' } });
    expect(res.json).toHaveBeenCalledWith({ success: true, product: { id: 'p1' } });

    productService.getProductById.mockRejectedValueOnce(httpError('Produit introuvable', 404));
    res = await call('getProductById', { params: { id: 'p1' } });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('getProductByFiltres renvoie 200, 404 ou l’erreur de validation', async () => {
    productService.getProductByFiltres.mockResolvedValueOnce([{ id: 'p1' }]);
    let res = await call('getProductByFiltres', { query: { name: 'h' } });
    expect(productService.getProductByFiltres).toHaveBeenCalledWith({ name: 'h' }, 'c1');
    expect(res.status).toHaveBeenCalledWith(200);

    productService.getProductByFiltres.mockResolvedValueOnce([]);
    res = await call('getProductByFiltres', {});
    expect(res.status).toHaveBeenCalledWith(404);

    productService.getProductByFiltres.mockRejectedValueOnce(
      httpError('Paramètres invalides', 400)
    );
    res = await call('getProductByFiltres', {});
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('getProductsByCategories renvoie 404 sans produit', async () => {
    productService.getProductsByCategories.mockResolvedValueOnce([]);
    const res = await call('getProductsByCategories', {});
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it.each([
    'getSumProductByCategorie',
    'getProductsByCategories',
    'getSuppliersByProduct',
    'getProductsBelowStockMin',
    'getOutOfStockProducts',
    'getLowStockDashboard',
  ])('%s renvoie les données de la société ou 500', async (handler) => {
    productService[handler].mockResolvedValueOnce([{ id: 'p1' }]);
    let res = await call(handler, {});
    expect(productService[handler]).toHaveBeenCalledWith('c1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, products: [{ id: 'p1' }] });

    productService[handler].mockRejectedValueOnce(new Error('db'));
    res = await call(handler, {});
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
