const dashboardService = require('../../../src/services/dashboardService');
const prisma = require('../../../config/db');

jest.mock('../../../config/db', () => ({
  movementItem: { findMany: jest.fn() },
  product: { findFirst: jest.fn() },
}));

const today = () => new Date().toISOString().split('T')[0];

describe('dashboardService — produits', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getTopProducts', () => {
    it('agrège par produit, trie par quantité et garde les 5 premiers', async () => {
      const line = (productId, quantity, unit_price) => ({
        productId,
        quantity,
        unit_price,
        product: { id: productId, name: productId },
      });
      prisma.movementItem.findMany.mockResolvedValue([
        line('a', 1, 10),
        line('b', 5, 2),
        line('a', 2, 10.1234),
        line('c', 4, 1),
        line('d', 3, 1),
        line('e', 2, 1),
        line('f', 1, 1),
      ]);

      const top = await dashboardService.getTopProducts('c1');

      expect(top.map((t) => t.product.id)).toEqual(['b', 'c', 'a', 'd', 'e']);
      expect(top[2]).toMatchObject({ totalQuantity: 3, totalRevenue: 30.247 });
      expect(prisma.movementItem.findMany.mock.calls[0][0].where.movement).toEqual({
        companyId: 'c1',
        type: 'OUT',
        status: { not: 'CANCELLED' },
      });
    });
  });

  describe('getStockHistory', () => {
    const product = {
      id: 'p1',
      name: 'Huile',
      code: 1,
      stock_quantity: 12,
      stock_min: 4,
      stock_max: null,
      unit_of_measure: 'L',
    };

    it("renvoie un historique vide quand l'entreprise n'a aucun produit", async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      await expect(dashboardService.getStockHistory('c1', 'all')).resolves.toEqual({
        product: null,
        history: [],
      });
      expect(prisma.product.findFirst).toHaveBeenCalledTimes(1);
    });

    it('se rabat sur le produit le plus bas en stock si le produit demandé est absent', async () => {
      prisma.product.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(product);
      prisma.movementItem.findMany.mockResolvedValue([]);
      const res = await dashboardService.getStockHistory('c1', 'zz', 'abc');
      expect(prisma.product.findFirst.mock.calls[1][0]).toEqual({
        where: { companyId: 'c1' },
        orderBy: { stock_quantity: 'asc' },
      });
      expect(res.history).toHaveLength(31);
      expect(res.history[0].stockMax).toBe(10);
    });

    it('cumule entrées, sorties et ajustements du jour', async () => {
      prisma.product.findFirst.mockResolvedValue(product);
      const at = new Date();
      prisma.movementItem.findMany.mockResolvedValue([
        { quantity: 10, movement: { type: 'IN', created_at: at } },
        { quantity: 3, movement: { type: 'OUT', created_at: at } },
        { quantity: -2, movement: { type: 'ADJUSTMENT', created_at: at } },
        { quantity: 1, movement: { type: 'RETURN_CLIENT', created_at: at } },
      ]);

      const res = await dashboardService.getStockHistory('c1', 'p1', 7);
      const day = res.history.find((h) => h.date === today());

      expect(res.history).toHaveLength(8);
      expect(day).toMatchObject({ entree: 11, sortie: 5, stockReel: 12 });
      expect(res.history[0].stockReel).toBe(6);
      expect(res.product).toEqual(product);
    });
  });
});
