const adminKpiService = require('../../../src/services/adminKpiService');
const prisma = require('../../../config/db');

jest.mock('../../../config/db', () => ({
  company: { count: jest.fn(), findMany: jest.fn() },
  user: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
  invoice: { aggregate: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
  payment: { aggregate: jest.fn(), findMany: jest.fn() },
  movement: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
  quote: { count: jest.fn() },
  invitation: { count: jest.fn() },
  product: { count: jest.fn() },
  client: { count: jest.fn() },
  supplier: { count: jest.fn() },
}));

const resetPrisma = () => {
  prisma.company.count.mockResolvedValue(0);
  prisma.company.findMany.mockResolvedValue([]);
  prisma.user.count.mockResolvedValue(0);
  prisma.user.findMany.mockResolvedValue([]);
  prisma.user.groupBy.mockResolvedValue([]);
  prisma.invoice.aggregate.mockResolvedValue({ _sum: {}, _count: { _all: 0 } });
  prisma.invoice.findMany.mockResolvedValue([]);
  prisma.invoice.groupBy.mockResolvedValue([]);
  prisma.payment.aggregate.mockResolvedValue({ _sum: {} });
  prisma.payment.findMany.mockResolvedValue([]);
  prisma.movement.count.mockResolvedValue(0);
  prisma.movement.findMany.mockResolvedValue([]);
  prisma.movement.groupBy.mockResolvedValue([]);
  prisma.quote.count.mockResolvedValue(0);
  prisma.invitation.count.mockResolvedValue(0);
  prisma.product.count.mockResolvedValue(0);
  prisma.client.count.mockResolvedValue(0);
  prisma.supplier.count.mockResolvedValue(0);
};

describe('AdminKpiService', () => {
  beforeEach(resetPrisma);

  describe('withDelta', () => {
    it('calcule la variation en %', () => {
      expect(adminKpiService.withDelta(150, 100)).toEqual({
        value: 150,
        previous: 100,
        delta_pct: 50,
      });
    });

    it('renvoie null quand la période précédente est vide (pas de division par zéro)', () => {
      expect(adminKpiService.withDelta(10, 0).delta_pct).toBeNull();
    });
  });

  describe('getOverview', () => {
    it('agrège snapshot et flux sans NaN sur une plateforme vide', async () => {
      const result = await adminKpiService.getOverview({ period: 'month' });

      expect(result.period.key).toBe('month');
      expect(result.snapshot.users.activation_rate_pct).toBe(0);
      expect(result.snapshot.users.avg_per_company).toBe(0);
      expect(result.kpis.collection_rate_pct.value).toBe(0);
      expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/);
    });

    it('compte une entreprise active une seule fois (facture + mouvement)', async () => {
      prisma.invoice.groupBy.mockResolvedValue([{ companyId: 'c1' }]);
      prisma.movement.groupBy.mockResolvedValue([{ companyId: 'c1' }, { companyId: 'c2' }]);

      const result = await adminKpiService.getOverview({ period: '30d' });
      expect(result.kpis.active_companies.value).toBe(2);
    });

    it('calcule le taux de recouvrement et l’encours', async () => {
      prisma.invoice.aggregate.mockImplementation(({ _count }) =>
        Promise.resolve(
          _count
            ? { _sum: { total_ttc: 1000, total_ht: 840 }, _count: { _all: 4 } }
            : { _sum: { total_ttc: 500, amount_paid: 200 } }
        )
      );
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 250 } });

      const result = await adminKpiService.getOverview({ period: 'month' });
      expect(result.kpis.revenue_billed_ttc.value).toBe(1000);
      expect(result.kpis.collection_rate_pct.value).toBe(25);
      expect(result.snapshot.receivables.outstanding_ttc).toBe(300);
    });

    it('ventile les utilisateurs par rôle entreprise', async () => {
      prisma.user.groupBy.mockResolvedValue([
        { company_role: 'OWNER', _count: { _all: 3 } },
        { company_role: 'ACCOUNTANT', _count: { _all: 1 } },
      ]);

      const result = await adminKpiService.getOverview({});
      expect(result.snapshot.users.by_company_role).toEqual({
        OWNER: 3,
        STOCK: 0,
        ACCOUNTANT: 1,
      });
    });

    it('rejette une période invalide (400)', async () => {
      await expect(adminKpiService.getOverview({ period: 'decade' })).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe('getTrend', () => {
    it('produit un point par mois, y compris les mois vides', async () => {
      const now = new Date();
      prisma.invoice.findMany.mockResolvedValue([
        { date: now, total_ttc: 100.5 },
        { date: now, total_ttc: 50 },
      ]);
      prisma.company.findMany.mockResolvedValue([{ created_at: now }]);

      const result = await adminKpiService.getTrend({ months: '3' });
      expect(result.series).toHaveLength(3);

      const last = result.series[2];
      expect(last.invoice_count).toBe(2);
      expect(last.revenue_billed_ttc).toBe(150.5);
      expect(last.new_companies).toBe(1);
      expect(result.series[0].invoice_count).toBe(0);
    });

    it('borne le nombre de mois (400 au-delà de 24)', async () => {
      await expect(adminKpiService.getTrend({ months: '60' })).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe('getTopCompanies', () => {
    it('classe les entreprises par CA et joint leur nom', async () => {
      prisma.invoice.groupBy.mockResolvedValue([
        { companyId: 'c2', _sum: { total_ttc: 900 } },
        { companyId: 'c1', _sum: { total_ttc: 300 } },
      ]);
      prisma.company.findMany.mockResolvedValue([
        { id: 'c1', name: 'Alpha' },
        { id: 'c2', name: 'Beta' },
      ]);

      const result = await adminKpiService.getTopCompanies({ by: 'revenue', limit: '5' });
      expect(result.ranking).toEqual([
        { rank: 1, company: { id: 'c2', name: 'Beta' }, value: 900 },
        { rank: 2, company: { id: 'c1', name: 'Alpha' }, value: 300 },
      ]);
      expect(prisma.invoice.groupBy).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    });

    it('rejette un critère inconnu', async () => {
      await expect(adminKpiService.getTopCompanies({ by: 'password' })).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('rejette une limite hors bornes', async () => {
      await expect(adminKpiService.getTopCompanies({ limit: '0' })).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe('getHealth', () => {
    it('signale les entreprises sans activité récente', async () => {
      prisma.company.findMany
        .mockResolvedValueOnce([
          { id: 'c1', name: 'Active' },
          { id: 'c2', name: 'Dormante' },
        ])
        .mockResolvedValueOnce([{ id: 'c3', name: 'Sans produit' }]);
      prisma.movement.groupBy.mockResolvedValue([{ companyId: 'c1' }]);
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);

      const result = await adminKpiService.getHealth();
      expect(result.dormant_companies.count).toBe(1);
      expect(result.dormant_companies.sample[0].id).toBe('c2');
      expect(result.onboarding_incomplete.count).toBe(1);
      expect(result.unverified_users.count).toBe(1);
    });
  });
});
