const dashboardService = require('../../../src/services/dashboardService');
const prisma = require('../../../config/db');

jest.mock('../../../config/db', () => ({
  invoice: {
    aggregate: jest.fn().mockResolvedValue({ _sum: { total_ttc: 1000 } }),
    findMany: jest.fn().mockResolvedValue([]),
  },
  movement: { count: jest.fn().mockResolvedValue(5) },
  movementItem: { findMany: jest.fn().mockResolvedValue([]) },
  product: {
    count: jest.fn().mockResolvedValue(2),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
  },
}));

describe('DashboardService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardSummary', () => {
    it('devrait retourner les stats globales', async () => {
      const result = await dashboardService.getDashboardSummary('company-id');
      expect(result).toHaveProperty('totalRevenue');
      expect(result).toHaveProperty('totalSales');
      expect(result).toHaveProperty('outOfStockProducts');
      expect(result).toHaveProperty('recentInvoices');
    });
  });

  describe('getDashboardRevenue', () => {
    it('devrait retourner le CA pour une période donnée', async () => {
      prisma.invoice.aggregate.mockResolvedValue({
        _sum: { total_ttc: 5000, total_ht: 4000, tva_amount: 1000 },
        _count: { id: 3 },
      });
      const result = await dashboardService.getDashboardRevenue('company-id', 'month');
      expect(result).toHaveProperty('period', 'month');
      expect(result).toHaveProperty('totalRevenueTTC', 5000);
      expect(result).toHaveProperty('invoiceCount', 3);
    });
  });

  describe('getStockHealth', () => {
    it('devrait catégoriser les stocks sains, alertes et ruptures', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'P1', stock_quantity: 0, stock_min: 10, stock_max: 50 },
        { id: 'p2', name: 'P2', stock_quantity: 5, stock_min: 10, stock_max: 50 },
        { id: 'p3', name: 'P3', stock_quantity: 20, stock_min: 10, stock_max: 50 },
      ]);

      const result = await dashboardService.getStockHealth('company-id');
      expect(result).toHaveProperty('summary');
      expect(result.summary.totalProducts).toBe(3);
      expect(result.summary.outOfStockCount).toBe(1);
      expect(result.summary.alertCount).toBe(1);
      expect(result.summary.optimalCount).toBe(1);
      expect(result.criticalProducts.length).toBe(2);
    });
  });

  describe('getStockHistory', () => {
    it('devrait retourner l historique d un produit avec ses seuils', async () => {
      prisma.product.findFirst.mockResolvedValue({
        id: 'p1',
        name: 'P1',
        code: 101,
        stock_quantity: 15,
        stock_min: 5,
        stock_max: 30,
        unit_of_measure: 'pièce',
      });
      prisma.movementItem.findMany.mockResolvedValue([]);

      const result = await dashboardService.getStockHistory('company-id', 'p1', 15);
      expect(result).toHaveProperty('product');
      expect(result.product.id).toBe('p1');
      expect(result).toHaveProperty('history');
      expect(result.history.length).toBeGreaterThan(0);
      expect(result.history[0]).toHaveProperty('stockReel');
      expect(result.history[0]).toHaveProperty('stockMin', 5);
    });
  });
});
