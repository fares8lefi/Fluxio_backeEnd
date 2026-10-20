jest.mock('../../../config/db', () => require('../helpers/prismaMock')());
const prisma = require('../../../config/db');
const productRepository = require('../../../src/repositories/productRepository');

const product = (extra = {}) => ({
  id: 'p1',
  name: 'Huile',
  purchase_price: 11.9,
  selling_price: 10,
  tva_rate: 19,
  stock_quantity: 3,
  stock_min: 5,
  ...extra,
});

beforeEach(() => jest.clearAllMocks());

describe('productRepository', () => {
  describe('addProduct', () => {
    it('relie société, fournisseur, catégorie et calcule les prix HT/TTC', async () => {
      prisma.product.create.mockResolvedValue(product());
      const res = await productRepository.addProduct({
        name: 'Huile',
        companyId: 'c1',
        supplierId: 's1',
        categoryId: 'k1',
      });
      expect(prisma.product.create.mock.calls[0][0].data).toEqual({
        name: 'Huile',
        company: { connect: { id: 'c1' } },
        supplier: { connect: { id: 's1' } },
        category: { connect: { id: 'k1' } },
      });
      expect(res).toMatchObject({ price_ht: 10, price_ttc: 11.9 });
    });

    it('omet les relations absentes et applique 19 % par défaut', async () => {
      prisma.product.create.mockResolvedValue(product({ tva_rate: undefined }));
      const res = await productRepository.addProduct({ name: 'Huile' });
      expect(prisma.product.create.mock.calls[0][0].data).toEqual({
        name: 'Huile',
        company: undefined,
        supplier: undefined,
        category: undefined,
      });
      expect(res.price_ttc).toBe(11.9);
    });
  });

  describe('updateProduct', () => {
    beforeEach(() => prisma.product.update.mockResolvedValue(product()));

    it('connecte ou déconnecte fournisseur et catégorie', async () => {
      await productRepository.updateProduct({ supplierId: 's2', categoryId: null }, 'p1', 'c1');
      expect(prisma.product.update.mock.calls[0][0]).toMatchObject({
        where: { id: 'p1', companyId: 'c1' },
        data: { supplier: { connect: { id: 's2' } }, category: { disconnect: true } },
      });

      await productRepository.updateProduct({ supplierId: '', categoryId: 'k2' }, 'p1', 'c1');
      expect(prisma.product.update.mock.calls[1][0].data).toMatchObject({
        supplier: { disconnect: true },
        category: { connect: { id: 'k2' } },
      });
    });

    it('ne touche pas aux relations non fournies et accepte une transaction', async () => {
      const tx = { product: { update: jest.fn().mockResolvedValue(product()) } };
      const res = await productRepository.updateProduct({ stock_quantity: 9 }, 'p1', 'c1', tx);
      expect(tx.product.update.mock.calls[0][0].data).toEqual({
        stock_quantity: 9,
        supplier: undefined,
        category: undefined,
      });
      expect(res.price_ht).toBe(10);
    });
  });

  it('getAllProduct, findPaginated et getProductByFiltres calculent les prix', async () => {
    prisma.product.findMany.mockResolvedValue([product()]);
    const [all] = await productRepository.getAllProduct('c1');
    const [page] = await productRepository.findPaginated(3, 20, 'c1');
    const [filtered] = await productRepository.getProductByFiltres({ companyId: 'c1', name: 'h' });
    [all, page, filtered].forEach((p) => expect(p.price_ttc).toBe(11.9));
    expect(prisma.product.findMany.mock.calls[0][0].where).toEqual({ companyId: 'c1' });
    expect(prisma.product.findMany.mock.calls[1][0]).toMatchObject({ skip: 40, take: 20 });
    expect(prisma.product.findMany.mock.calls[2][0].where).toEqual({ companyId: 'c1', name: 'h' });
  });

  it('countAll compte les produits de la société', async () => {
    prisma.product.count.mockResolvedValue(8);
    await expect(productRepository.countAll('c1')).resolves.toBe(8);
    expect(prisma.product.count).toHaveBeenCalledWith({ where: { companyId: 'c1' } });
  });

  describe('getProductById', () => {
    it('renvoie le produit avec ses prix calculés', async () => {
      prisma.product.findFirst.mockResolvedValue(product());
      const res = await productRepository.getProductById('p1', 'c1');
      expect(prisma.product.findFirst.mock.calls[0][0].where).toEqual({
        id: 'p1',
        companyId: 'c1',
      });
      expect(res.price_ht).toBe(10);
    });

    it('renvoie null pour un produit inconnu (y compris dans une transaction)', async () => {
      const tx = { product: { findFirst: jest.fn().mockResolvedValue(null) } };
      await expect(productRepository.getProductById('p1', 'c1', tx)).resolves.toBeNull();
    });
  });

  it('deleteProduct supprime dans la société', async () => {
    await productRepository.deleteProduct('p1', 'c1');
    expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 'p1', companyId: 'c1' } });
    const tx = { product: { delete: jest.fn() } };
    await productRepository.deleteProduct('p1', 'c1', tx);
    expect(tx.product.delete).toHaveBeenCalled();
  });

  it('getProductsByCategories regroupe par nom de catégorie', async () => {
    prisma.product.findMany.mockResolvedValue([
      product({ category: { name: 'Épicerie' }, supplier: { name: 'Sotupa' } }),
      product({ id: 'p2', category: { name: 'Épicerie' } }),
      product({ id: 'p3' }),
    ]);
    const res = await productRepository.getProductsByCategories('c1');
    expect(res).toEqual([
      {
        category: 'Épicerie',
        count: 2,
        products: [
          { id: 'p1', name: 'Huile', selling_price: 10, stock_quantity: 3, supplier: 'Sotupa' },
          { id: 'p2', name: 'Huile', selling_price: 10, stock_quantity: 3, supplier: null },
        ],
      },
      expect.objectContaining({ category: 'Sans catégorie', count: 1 }),
    ]);
  });

  it('getSumProductByCategorie nomme les catégories et convertit les agrégats', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { categoryId: 'k1', product_count: 2n, total_value: '30.5' },
      { categoryId: null, product_count: 1n, total_value: null },
    ]);
    prisma.category.findMany.mockResolvedValue([{ id: 'k1', name: 'Épicerie' }]);

    await expect(productRepository.getSumProductByCategorie('c1')).resolves.toEqual([
      { category: 'Épicerie', product_count: 2, total_value: 30.5 },
      { category: 'Sans catégorie', product_count: 1, total_value: 0 },
    ]);
    expect(prisma.$queryRaw.mock.calls[0]).toContain('c1');
    expect(prisma.category.findMany).toHaveBeenCalledWith({ where: { id: { in: ['k1'] } } });
  });

  it('getSuppliersByProduct associe chaque produit à son fournisseur', async () => {
    prisma.product.findMany.mockResolvedValue([
      { name: 'Huile', supplier: { name: 'Sotupa' } },
      { name: 'Sucre', supplier: null },
    ]);
    await expect(productRepository.getSuppliersByProduct('c1')).resolves.toEqual([
      { productName: 'Huile', supplier: 'Sotupa' },
      { productName: 'Sucre', supplier: null },
    ]);
  });

  it('getProductsBelowStockMin et getLowStockDashboard comparent stock et minimum', async () => {
    const rows = [
      { id: 'p1', stock_quantity: 1, stock_min: 5 },
      { id: 'p2', stock_quantity: 5, stock_min: 5 },
      { id: 'p3', stock_quantity: 0, stock_min: 2 },
    ];
    prisma.product.findMany.mockResolvedValue(rows);
    const below = await productRepository.getProductsBelowStockMin('c1');
    expect(below.map((p) => p.id)).toEqual(['p1', 'p3']);
    await expect(productRepository.getLowStockDashboard('c1')).resolves.toBe(2);
  });

  it('getOutOfStockProducts filtre le stock à zéro', async () => {
    prisma.product.findMany.mockResolvedValue([{ id: 'p3' }]);
    await expect(productRepository.getOutOfStockProducts('c1')).resolves.toEqual([{ id: 'p3' }]);
    expect(prisma.product.findMany.mock.calls[0][0].where).toEqual({
      companyId: 'c1',
      stock_quantity: { equals: 0 },
    });
  });
});
