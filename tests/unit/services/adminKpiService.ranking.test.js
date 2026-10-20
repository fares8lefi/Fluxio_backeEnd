const adminKpiService = require('../../../src/services/adminKpiService');
const prisma = require('../../../config/db');

jest.mock('../../../config/db', () => ({
  company: { findMany: jest.fn() },
  user: { findMany: jest.fn(), groupBy: jest.fn() },
  invoice: { findMany: jest.fn(), groupBy: jest.fn() },
  payment: { findMany: jest.fn() },
  movement: { findMany: jest.fn(), groupBy: jest.fn() },
}));

describe('adminKpiService — séries et classements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.company.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.invoice.findMany.mockResolvedValue([]);
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.movement.findMany.mockResolvedValue([]);
  });

  it('getTrend compte les nouveaux utilisateurs du mois et ignore les dates hors série', async () => {
    const now = new Date();
    prisma.user.findMany.mockResolvedValue([
      { created_at: now },
      { created_at: now },
      { created_at: new Date('1999-01-01') },
      { created_at: null },
    ]);
    prisma.payment.findMany.mockResolvedValue([
      { date: now, amount: '120.1234' },
      { date: now, amount: null },
    ]);
    prisma.movement.findMany.mockResolvedValue([{ created_at: now }, { created_at: now }]);
    const { series } = await adminKpiService.getTrend({ months: 3 });
    expect(series).toHaveLength(3);
    expect(series.at(-1)).toMatchObject({
      new_users: 2,
      payments_collected: 120.123,
      movement_count: 2,
    });
    expect(series.reduce((n, b) => n + b.new_users, 0)).toBe(2);
  });

  describe('getTopCompanies', () => {
    beforeEach(() => {
      prisma.company.findMany.mockResolvedValue([{ id: 'c1', name: 'Atlas', is_active: true }]);
    });

    it.each([
      ['invoices', 'invoice'],
      ['movements', 'movement'],
      ['users', 'user'],
    ])('classe par %s à partir des comptages', async (by, model) => {
      prisma[model].groupBy.mockResolvedValue([
        { companyId: 'c1', _count: { _all: 7 } },
        { companyId: 'c9', _count: { _all: 3 } },
      ]);

      const res = await adminKpiService.getTopCompanies({ by, period: '30d', limit: '5' });

      expect(prisma[model].groupBy.mock.calls[0][0].take).toBe(5);
      expect(res.by).toBe(by);
      expect(res.ranking).toEqual([
        { rank: 1, company: { id: 'c1', name: 'Atlas', is_active: true }, value: 7 },
        { rank: 2, company: { id: 'c9', name: null }, value: 3 },
      ]);
      expect(prisma.company.findMany.mock.calls[0][0].where).toEqual({
        id: { in: ['c1', 'c9'] },
      });
    });

    it('refuse un critère inconnu', async () => {
      await expect(adminKpiService.getTopCompanies({ by: 'profit' })).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });
});
