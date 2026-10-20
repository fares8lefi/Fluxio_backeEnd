jest.mock('../../../src/repositories/productRepository');
jest.mock('../../../src/repositories/supplierRepository');
jest.mock('../../../src/repositories/categorieRepository');
const productRepository = require('../../../src/repositories/productRepository');
const supplierRepository = require('../../../src/repositories/supplierRepository');
const categorieRepository = require('../../../src/repositories/categorieRepository');
const productService = require('../../../src/services/productService');

const validProduct = (extra = {}) => ({
  code: '12',
  barcode: 6191234567,
  name: 'Huile 1L',
  purchase_price: 4.2,
  selling_price: 5.5,
  stock_min: 5,
  ...extra,
});

describe('productService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    productRepository.addProduct.mockImplementation(async (data) => ({ id: 'p1', ...data }));
  });

  describe('addProduct', () => {
    it('applique les valeurs par défaut (TVA 19 %, stock 0, pièce)', async () => {
      const res = await productService.addProduct(validProduct(), 'c1');
      expect(productRepository.addProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Huile 1L',
          tva_rate: 19,
          stock_quantity: 0,
          unit_of_measure: 'pièce',
          companyId: 'c1',
        })
      );
      expect(res.id).toBe('p1');
    });

    it('refuse des données invalides avec le détail par champ', async () => {
      await expect(productService.addProduct({ name: '' }, 'c1')).rejects.toMatchObject({
        statusCode: 400,
        details: expect.objectContaining({ name: expect.any(String) }),
      });
      expect(productRepository.addProduct).not.toHaveBeenCalled();
    });

    it('refuse un taux TVA hors barème', async () => {
      await expect(
        productService.addProduct(validProduct({ tva_rate: 10 }), 'c1')
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('vérifie que le fournisseur et la catégorie existent dans la société', async () => {
      supplierRepository.findById.mockResolvedValue(null);
      await expect(
        productService.addProduct(validProduct({ supplierId: 's1' }), 'c1')
      ).rejects.toMatchObject({ statusCode: 404, message: 'Fournisseur introuvable' });
      expect(supplierRepository.findById).toHaveBeenCalledWith('s1', 'c1');

      supplierRepository.findById.mockResolvedValue({ id: 's1' });
      categorieRepository.getById.mockResolvedValue(null);
      await expect(
        productService.addProduct(validProduct({ supplierId: 's1', categoryId: 'k1' }), 'c1')
      ).rejects.toMatchObject({ statusCode: 404, message: 'Catégorie introuvable' });

      categorieRepository.getById.mockResolvedValue({ id: 'k1' });
      await productService.addProduct(
        validProduct({ supplierId: 's1', categoryId: 'k1', tva_rate: 7 }),
        'c1'
      );
      expect(productRepository.addProduct).toHaveBeenCalledWith(
        expect.objectContaining({ supplierId: 's1', categoryId: 'k1', tva_rate: 7 })
      );
    });
  });

  describe('deleteProduct / getProductById', () => {
    it('renvoie 404 quand le produit est absent', async () => {
      productRepository.getProductById.mockResolvedValue(null);
      await expect(productService.deleteProduct('p1', 'c1')).rejects.toMatchObject({
        statusCode: 404,
      });
      await expect(productService.getProductById('p1', 'c1')).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(productRepository.deleteProduct).not.toHaveBeenCalled();
    });

    it('supprime ou renvoie le produit existant', async () => {
      productRepository.getProductById.mockResolvedValue({ id: 'p1' });
      productRepository.deleteProduct.mockResolvedValue({ id: 'p1' });
      await productService.deleteProduct('p1', 'c1');
      expect(productRepository.deleteProduct).toHaveBeenCalledWith('p1', 'c1');
      await expect(productService.getProductById('p1', 'c1')).resolves.toEqual({ id: 'p1' });
    });
  });

  describe('updateProduct', () => {
    it('renvoie 404 quand le produit est absent', async () => {
      productRepository.getProductById.mockResolvedValue(null);
      await expect(productService.updateProduct('p1', { name: 'x' }, 'c1')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('ne transmet que les champs fournis', async () => {
      productRepository.getProductById.mockResolvedValue({ id: 'p1' });
      await productService.updateProduct(
        'p1',
        {
          code: 1,
          barcode: 2,
          name: 'N',
          purchase_price: 1,
          selling_price: 2,
          stock_quantity: 3,
          stock_min: 1,
          stock_max: 9,
          tva_rate: 7,
          unit_of_measure: 'kg',
          supplierId: 's',
          categoryId: 'k',
          ignored: true,
        },
        'c1'
      );
      const [updates, id, companyId] = productRepository.updateProduct.mock.calls[0];
      expect(id).toBe('p1');
      expect(companyId).toBe('c1');
      expect(updates).not.toHaveProperty('ignored');
      expect(Object.keys(updates)).toHaveLength(12);

      await productService.updateProduct('p1', { name: 'Seul' }, 'c1');
      expect(productRepository.updateProduct.mock.calls[1][0]).toEqual({ name: 'Seul' });
    });
  });

  describe('getProductByFiltres', () => {
    beforeEach(() => productRepository.getProductByFiltres.mockResolvedValue([]));

    it('construit un filtre entre prix min et max', async () => {
      await productService.getProductByFiltres(
        { name: 'hui', stock_quantity: '3', minPrice: '1', maxPrice: '9' },
        'c1'
      );
      expect(productRepository.getProductByFiltres).toHaveBeenCalledWith({
        name: { contains: 'hui' },
        stock_quantity: 3,
        selling_price: { gte: 1, lte: 9 },
        companyId: 'c1',
      });
    });

    it('gère un seul bornage de prix', async () => {
      await productService.getProductByFiltres({ maxPrice: '9' }, 'c1');
      expect(productRepository.getProductByFiltres).toHaveBeenLastCalledWith({
        selling_price: { lte: 9 },
        companyId: 'c1',
      });
      await productService.getProductByFiltres({ minPrice: '2' }, 'c1');
      expect(productRepository.getProductByFiltres).toHaveBeenLastCalledWith({
        selling_price: { gte: 2 },
        companyId: 'c1',
      });
    });

    it('refuse des paramètres invalides', async () => {
      await expect(
        productService.getProductByFiltres({ maxPrice: '-1' }, 'c1')
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  it('getAllProductsPaginated renvoie produits et total', async () => {
    productRepository.findPaginated.mockResolvedValue([{ id: 'p1' }]);
    productRepository.countAll.mockResolvedValue(42);
    await expect(productService.getAllProductsPaginated(2, 10, 'c1')).resolves.toEqual({
      products: [{ id: 'p1' }],
      total: 42,
    });
    expect(productRepository.findPaginated).toHaveBeenCalledWith(2, 10, 'c1');
  });

  it.each([
    ['getAllProducts', 'getAllProduct'],
    ['getProductsByCategories', 'getProductsByCategories'],
    ['getSumProductByCategorie', 'getSumProductByCategorie'],
    ['getSuppliersByProduct', 'getSuppliersByProduct'],
    ['getProductsBelowStockMin', 'getProductsBelowStockMin'],
    ['getOutOfStockProducts', 'getOutOfStockProducts'],
    ['getLowStockDashboard', 'getLowStockDashboard'],
  ])('%s délègue au repository', async (serviceFn, repoFn) => {
    productRepository[repoFn].mockResolvedValue(['ok']);
    await expect(productService[serviceFn]('c1')).resolves.toEqual(['ok']);
    expect(productRepository[repoFn]).toHaveBeenCalledWith('c1');
  });
});
