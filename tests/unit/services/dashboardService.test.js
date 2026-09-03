const dashboardService = require('../../src/services/dashboardService');
const prisma = require('../../config/db');

jest.mock('../../config/db', () => ({
  user: { count: jest.fn() },
  product: { count: jest.fn(), findMany: jest.fn() },
  mouvment: { findMany: jest.fn() },
  invoice: { count: jest.fn(), findMany: jest.fn() }
}));

describe('DashboardService', () => {
  afterEach(() => { jest.clearAllMocks(); });

  describe('getSummary', () => {
    it('devrait retourner les stats globales', async () => {
      prisma.user.count.mockResolvedValue(10);
      prisma.product.count.mockResolvedValue(50);
      prisma.invoice.count.mockResolvedValue(5);
      
      const result = await dashboardService.getSummary('company-id');
      expect(result).toHaveProperty('totalUsers', 10);
      expect(result).toHaveProperty('totalProducts', 50);
      expect(result).toHaveProperty('totalInvoices', 5);
    });
  });
});
