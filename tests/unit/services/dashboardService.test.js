const dashboardService = require('../../../src/services/dashboardService');
const prisma = require('../../../config/db');

jest.mock('../../../config/db', () => ({
  invoice: {
    aggregate: jest.fn().mockResolvedValue({ _sum: { total_ttc: 1000 } }),
    findMany: jest.fn().mockResolvedValue([]),
  },
  movement: { count: jest.fn().mockResolvedValue(5) },
  movementItem: { findMany: jest.fn().mockResolvedValue([]) },
  product: { count: jest.fn().mockResolvedValue(2), findMany: jest.fn().mockResolvedValue([]) },
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
});
