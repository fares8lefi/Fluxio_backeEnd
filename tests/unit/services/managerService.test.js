const managerService = require('../../../src/services/managerService');
const prisma = require('../../../config/db');

jest.mock('../../../config/db', () => ({
  invoice: {
    aggregate: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  movement: {
    aggregate: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  movementItem: {
    aggregate: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  product: { findMany: jest.fn(), count: jest.fn() },
  category: { findMany: jest.fn() },
  client: { findMany: jest.fn(), count: jest.fn() },
  supplier: { findMany: jest.fn() },
  quote: { aggregate: jest.fn(), count: jest.fn() },
}));

const COMPANY = 'company-1';

const emptyAggregate = { _sum: {}, _count: { _all: 0 } };

const resetPrisma = () => {
  prisma.invoice.aggregate.mockResolvedValue(emptyAggregate);
  prisma.invoice.count.mockResolvedValue(0);
  prisma.invoice.findMany.mockResolvedValue([]);
  prisma.invoice.groupBy.mockResolvedValue([]);
  prisma.movement.aggregate.mockResolvedValue(emptyAggregate);
  prisma.movement.count.mockResolvedValue(0);
  prisma.movement.findMany.mockResolvedValue([]);
  prisma.movement.groupBy.mockResolvedValue([]);
  prisma.movementItem.aggregate.mockResolvedValue({ _sum: {} });
  prisma.movementItem.findMany.mockResolvedValue([]);
  prisma.movementItem.groupBy.mockResolvedValue([]);
  prisma.product.findMany.mockResolvedValue([]);
  prisma.product.count.mockResolvedValue(0);
  prisma.category.findMany.mockResolvedValue([]);
  prisma.client.findMany.mockResolvedValue([]);
  prisma.client.count.mockResolvedValue(0);
  prisma.supplier.findMany.mockResolvedValue([]);
  prisma.quote.aggregate.mockResolvedValue(emptyAggregate);
  prisma.quote.count.mockResolvedValue(0);
  managerService.clearCache();
};

describe('managerService', () => {
  beforeEach(resetPrisma);
  afterEach(() => jest.clearAllMocks());

  describe('resolvePeriod', () => {
    it('devrait rejeter une période inconnue', () => {
      expect(() => managerService.resolvePeriod({ period: 'hack' })).toThrow('Période invalide');
    });

    it('devrait refuser une période personnalisée incomplète', () => {
      expect(() => managerService.resolvePeriod({ period: 'custom' })).toThrow(
        'startDate et endDate sont obligatoires'
      );
    });

    it('devrait refuser une période dont la fin précède le début', () => {
      expect(() =>
        managerService.resolvePeriod({
          period: 'custom',
          startDate: '2026-05-10',
          endDate: '2026-05-01',
        })
      ).toThrow('startDate doit être antérieur à endDate');
    });

    it('devrait plafonner la durée d’une période personnalisée', () => {
      expect(() =>
        managerService.resolvePeriod({
          period: 'custom',
          startDate: '2010-01-01',
          endDate: '2026-01-01',
        })
      ).toThrow('ne peut pas dépasser');
    });

    it('devrait calculer une période précédente de même durée pour une période personnalisée', () => {
      const period = managerService.resolvePeriod({
        period: 'custom',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      });

      const spanDays =
        (period.endDate.getTime() - period.startDate.getTime()) / 86400000;
      const previousSpanDays =
        (period.previous.endDate.getTime() - period.previous.startDate.getTime()) / 86400000;

      expect(previousSpanDays).toBeCloseTo(spanDays, 0);
      expect(period.previous.endDate.getTime()).toBeLessThan(period.startDate.getTime());
    });

    it('devrait retourner les 5 périodes standards avec des bornes cohérentes', () => {
      ['30d', 'month', 'prev_month', 'year'].forEach((key) => {
        const period = managerService.resolvePeriod({ period: key });
        expect(period.key).toBe(key);
        expect(period.startDate <= period.endDate).toBe(true);
        expect(period.previous.endDate <= period.startDate).toBe(true);
      });
    });
  });

  describe('calculs défensifs', () => {
    it('safeRatio et safeDivide ne doivent jamais renvoyer NaN', () => {
      expect(managerService.safeRatio(10, 0)).toBe(0);
      expect(managerService.safeDivide(10, 0)).toBe(0);
      expect(managerService.safeRatio(50, 200)).toBe(25);
      expect(managerService.safeDivide(10, 4)).toBe(2.5);
      expect(managerService.round(undefined)).toBe(0);
    });
  });

  describe('getManagerKpis', () => {
    it('devrait distinguer CA facturé et CA encaissé et calculer le recouvrement', async () => {
      prisma.invoice.aggregate.mockImplementation(async ({ where }) => {
        if (where.invoice_type === 'SALE' && where.status === 'PAID') {
          return { _sum: { total_ttc: 400 } };
        }
        if (where.status === 'PENDING') return { _sum: { total_ttc: 600 } };
        if (where.invoice_type === 'SALE') {
          return { _sum: { total_ttc: 1000, total_ht: 800, tva_amount: 199, rs_amount: 10 } };
        }
        return emptyAggregate;
      });
      prisma.invoice.count.mockResolvedValue(4);
      prisma.client.count.mockResolvedValue(7);
      prisma.movement.aggregate.mockResolvedValue({ _sum: { total_amount: 1000 } });
      prisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'Clavier', code: 1, stock_quantity: 10, stock_min: 2, stock_max: 50, purchase_price: 30, selling_price: 50, tva_rate: 19, categoryId: null },
      ]);

      const result = await managerService.getManagerKpis(COMPANY, { period: 'month' });

      expect(result.kpis.revenue_billed_ttc.value).toBe(1000);
      expect(result.kpis.revenue_collected.value).toBe(400);
      expect(result.kpis.collection_rate_pct.value).toBe(40);
      expect(result.kpis.outstanding_ttc.value).toBe(600);
      expect(result.kpis.average_basket.value).toBe(250);
      expect(result.kpis.client_count.value).toBe(7);
      expect(result.kpis.stock_value_cost.value).toBe(300);
      expect(result.kpis.margin_estimated_note).toContain('Estimation');
      expect(result.period).toHaveProperty('previousStartDate');
    });

    it('devrait renvoyer delta_pct null quand la période précédente est vide', async () => {
      const result = await managerService.getManagerKpis(COMPANY, { period: '30d' });
      expect(result.kpis.revenue_billed_ttc.delta_pct).toBeNull();
      expect(result.kpis.revenue_billed_ttc.value).toBe(0);
    });
  });

  describe('getManagerSales', () => {
    const now = new Date();
    const daysAgo = (days) => new Date(now.getTime() - days * 86400000);

    it('devrait ventiler la TVA par taux et calculer l’ageing', async () => {
      prisma.invoice.findMany.mockImplementation(async ({ where }) => {
        // Requête principale : aucun filtre invoice_type (tous types confondus)
        if (!where.invoice_type) {
          return [
            {
              date: daysAgo(10),
              status: 'PENDING',
              invoice_type: 'SALE',
              is_suspended: false,
              total_ht: 200,
              total_ttc: 240,
              tva_amount: 38,
              timbre_fiscal: 1,
              rs_amount: 0,
              net_payable: 240,
              tva_breakdown: JSON.stringify([{ rate: 19, base_ht: 200, tva_amount: 38 }]),
            },
            {
              date: daysAgo(90),
              status: 'PENDING',
              invoice_type: 'SALE',
              is_suspended: false,
              total_ht: 100,
              total_ttc: 120,
              tva_amount: 19,
              timbre_fiscal: 1,
              rs_amount: 0,
              net_payable: 120,
              tva_breakdown: '{invalide',
            },
            {
              date: daysAgo(200),
              status: 'PENDING',
              invoice_type: 'SALE',
              is_suspended: false,
              total_ht: 300,
              total_ttc: 300,
              tva_amount: 0,
              timbre_fiscal: 0,
              rs_amount: 0,
              net_payable: 300,
              tva_breakdown: null,
            },
            {
              date: daysAgo(5),
              status: 'PAID',
              invoice_type: 'SALE',
              is_suspended: true,
              total_ht: 500,
              total_ttc: 500,
              tva_amount: 0,
              timbre_fiscal: 0,
              rs_amount: 0,
              net_payable: 500,
              tva_breakdown: null,
            },
            {
              date: daysAgo(15),
              status: 'PENDING',
              invoice_type: 'CREDIT_NOTE',
              is_suspended: false,
              total_ht: 50,
              total_ttc: 60,
              tva_amount: 9.5,
              timbre_fiscal: 1,
              rs_amount: 0,
              net_payable: 60,
              tva_breakdown: null,
            },
          ];
        }
        // série 12 mois
        return [];
      });

      const result = await managerService.getManagerSales(COMPANY, { period: 'year' });

      expect(result.totals.billed_ttc).toBe(1160);
      expect(result.totals.collected_ttc).toBe(500);
      expect(result.totals.suspended_ttc).toBe(500);
      expect(result.totals.credit_notes_ttc).toBe(60);
      expect(result.totals.net_after_credit_notes).toBe(1100);
      expect(result.totals.sale_invoice_count).toBe(4);
      expect(result.totals.credit_note_count).toBe(1);

      // Ageing : 240 (10 j) < 30 j ; 120 (90 j) + 300 (200 j) > 60 j
      // (le tva_breakdown corrompu est ignoré sans erreur)
      expect(result.collection.ageing.lt_30).toBe(240);
      expect(result.collection.ageing['30_60']).toBe(0);
      expect(result.collection.ageing.gt_60).toBe(420);
      expect(result.collection.outstanding_ttc).toBe(660);
      expect(result.collection.rate_pct).toBeCloseTo(43.1, 1);

      // tva_breakdown corrompu => aucune exception, ventilation partielle
      expect(result.tva_by_rate).toEqual([
        { rate: 19, base_ht: 200, tva_amount: 38 },
      ]);
      expect(result.trend).toHaveLength(12);
    });

    it('ne doit jamais renvoyer NaN sur une période vide', async () => {
      const result = await managerService.getManagerSales(COMPANY, { period: '30d' });
      expect(result.totals.billed_ttc).toBe(0);
      expect(result.collection.rate_pct).toBe(0);
      expect(result.not_invoiced_sales.amount_ht).toBe(0);
    });
  });

  describe('getManagerClients', () => {
    it('devrait compter les nouveaux clients et la concentration sur le CA réel', async () => {
      const startOfPeriod = new Date();
      startOfPeriod.setUTCMonth(startOfPeriod.getUTCMonth(), 1);
      startOfPeriod.setUTCHours(0, 0, 0, 0);

      prisma.client.count.mockImplementation(async ({ where }) =>
      where.is_active ? 7 : 10
    );
      prisma.movement.groupBy.mockResolvedValue([
        { clientId: 'c1', _min: { created_at: startOfPeriod } }, // nouveau
        { clientId: 'c2', _min: { created_at: new Date('2024-01-01') } }, // ancien
      ]);
      prisma.invoice.aggregate.mockResolvedValue({ _sum: { total_ttc: 1200 }, _count: { clientId: 4 } });
      // invoice.groupBy sert deux fois : classement clients (avec `take` + `_count`)
      // et clients à risque (avec `_min`, sans `take`).
      prisma.invoice.groupBy.mockImplementation(async ({ take }) => {
        if (!take) {
          return [{ clientId: 'c2', _sum: { total_ttc: 300 }, _min: { date: new Date('2025-01-01') } }];
        }
        return [
          { clientId: 'c2', _sum: { total_ttc: 300 }, _count: { _all: 3 } },
          { clientId: 'c3', _sum: { total_ttc: 200 }, _count: { _all: 2 } },
          { clientId: 'c4', _sum: { total_ttc: 100 }, _count: { _all: 1 } },
        ];
      });
      prisma.client.findMany.mockResolvedValue([
        { id: 'c2', name: 'Alpha', matriculeFiscale: 'A1' },
        { id: 'c3', name: 'Beta', matriculeFiscale: 'B1' },
        { id: 'c4', name: 'Gamma', matriculeFiscale: 'G1' },
      ]);

      const result = await managerService.getManagerClients(COMPANY, { period: 'year' });

      expect(result.counts.total).toBe(10);
      expect(result.counts.active).toBe(7);
      expect(result.counts.inactive).toBe(3);
      expect(result.counts.new_in_period).toBe(1);
      // part rapportée au CA facturé de la période (1200), pas au top N
      expect(result.top_clients[0].share_pct).toBe(25);
      expect(result.top_clients[0].invoice_count).toBe(3);
      expect(result.concentration.top5_share_pct).toBe(50);
      expect(result.at_risk[0]).toMatchObject({ name: 'Alpha', outstanding_ttc: 300 });
    });
  });

  describe('getManagerStock', () => {
    it('devrait valoriser le stock, calculer couverture, retours et anomalies', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'A', code: 1, stock_quantity: 100, stock_min: 10, stock_max: 200, purchase_price: 10, selling_price: 12, tva_rate: 19, categoryId: 'cat1' },
        { id: 'p2', name: 'B', code: 2, stock_quantity: 0, stock_min: 5, stock_max: 50, purchase_price: 20, selling_price: 19, tva_rate: 19, categoryId: 'cat1' },
        { id: 'p3', name: 'C', code: 3, stock_quantity: -2, stock_min: 5, stock_max: 50, purchase_price: 5, selling_price: 8, tva_rate: 19, categoryId: 'cat2' },
      ]);
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat1', name: 'Boissons' },
        { id: 'cat2', name: 'Divers' },
      ]);
      prisma.movementItem.aggregate.mockResolvedValue({ _sum: { quantity: 30 } }); // 1/jour
      prisma.movementItem.findMany.mockResolvedValue([
        { quantity: 2, unit_price: 100, product: { purchase_price: 60, categoryId: 'cat1' } },
      ]);
      prisma.movement.aggregate.mockImplementation(async ({ where }) => {
        if (where.type === 'IN') return { _sum: { total_amount: 500 }, _count: { _all: 2 } };
        if (where.type === 'RETURN_SUPPLIER') return { _sum: { total_amount: 20 }, _count: { _all: 1 } };
        return { _sum: { total_amount: 0 }, _count: { _all: 0 } };
      });
      prisma.movementItem.groupBy.mockResolvedValue([{ productId: 'p1', _sum: { quantity: 10 } }]);

      const result = await managerService.getManagerStock(COMPANY, { period: 'month' });

      expect(result.valuation.cost_value).toBe(990); // 100*10 + 0*20 + (-2)*5
      expect(result.valuation.sale_value).toBe(1184); // 100*12 + 0*19 + (-2)*8
      expect(result.valuation.potential_margin).toBe(194);
      expect(result.coverage_days).toBe(98); // (100 + 0 - 2) / 1
      expect(result.purchases.total).toBe(500);
      expect(result.returns.total).toBe(20);
      expect(result.anomalies.out_of_stock_count).toBe(2); // p2 (0) et p3 (-2)
      expect(result.anomalies.below_min_count).toBe(0);
      expect(result.anomalies.overstock_count).toBe(0);
      expect(result.anomalies.negative_stock_count).toBe(1);
      expect(result.anomalies.never_sold_count).toBe(2); // p2 et p3 jamais vendus
      expect(result.by_category[0].category).toBe('Boissons');
      expect(result.low_margin_products[0].name).toBe('B');
    });
  });

  describe('getManagerActivity', () => {
    it('devrait agréger l’activité et la conformité', async () => {
      prisma.movement.groupBy.mockResolvedValue([
        { type: 'IN', _count: { _all: 3 } },
        { type: 'OUT', _count: { _all: 5 } },
      ]);
      prisma.movement.count.mockResolvedValue(2);
      prisma.movement.findMany.mockResolvedValue([
        { created_at: new Date(), total_amount: 100, type: 'OUT' },
        { created_at: new Date(), total_amount: 50, type: 'OUT' },
      ]);
      prisma.movementItem.findMany.mockResolvedValue([
        { quantity: 3, unit_price: 10, product: { name: 'Clavier' } },
      ]);
      prisma.quote.aggregate.mockResolvedValue({ _sum: { total_ttc: 800 }, _count: { _all: 4 } });
      prisma.quote.count.mockResolvedValue(1);
      prisma.client.count.mockResolvedValue(1);

      const result = await managerService.getManagerActivity(COMPANY, { period: 'month' });

      expect(result.movements.by_type.IN).toBe(3);
      expect(result.movements.by_type.OUT).toBe(5);
      expect(result.movements.total).toBe(8);
      expect(result.movements.cancelled).toBe(2);
      expect(result.monthly_activity).toHaveLength(12);
      expect(result.top_products[0]).toMatchObject({ name: 'Clavier', revenue_ht: 30 });
      expect(result.quotes.conversion_rate_pct).toBe(25);
      expect(result.compliance.clients_missing_matricule_count).toBe(1);
    });
  });

  describe('cache', () => {
    it('ne doit pas refaire les requêtes pour une même période (cache 60 s)', async () => {
      await managerService.getManagerSales(COMPANY, { period: 'month' });
      const callsAfterFirst = prisma.invoice.findMany.mock.calls.length;

      await managerService.getManagerSales(COMPANY, { period: 'month' });
      expect(prisma.invoice.findMany.mock.calls.length).toBe(callsAfterFirst);

      managerService.clearCache();
      await managerService.getManagerSales(COMPANY, { period: 'month' });
      expect(prisma.invoice.findMany.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });

    it('ne doit pas partager la clé de cache entre les blocs « sales » et « stock »', async () => {
      // Régression : les deux charges utilisaient la clé `sales:<company>:<periode>`.
      // Selon l'ordre d'arrivée des requêtes HTTP (les 5 blocs sont chargés en
      // parallèle par le front), `loadSalesAnalytics` pouvait lire la réponse du
      // bloc sales → `analytics.byCategory` undefined → 500 sur « Stock & achats ».
      const sales = await managerService.getManagerSales(COMPANY, { period: 'month' });
      const stock = await managerService.getManagerStock(COMPANY, { period: 'month' });

      // Charge inversée : le bloc stock ne doit pas polluer le bloc sales.
      managerService.clearCache();
      await managerService.getManagerStock(COMPANY, { period: 'month' });
      const salesAfterStock = await managerService.getManagerSales(COMPANY, { period: 'month' });

      expect(sales.totals).toBeDefined();
      expect(sales.collection).toBeDefined();
      expect(sales.trend).toHaveLength(12);
      expect(stock.by_category).toEqual([]);
      expect(stock.valuation.cost_value).toBe(0);
      expect(salesAfterStock.totals).toBeDefined();
      expect(salesAfterStock.collection).toBeDefined();
    });

    it('doit charger les 5 blocs en parallèle sans poisoned cache', async () => {
      const [kpis, sales, clients, stock, activity] = await Promise.all([
        managerService.getManagerKpis(COMPANY, { period: 'month' }),
        managerService.getManagerSales(COMPANY, { period: 'month' }),
        managerService.getManagerClients(COMPANY, { period: 'month' }),
        managerService.getManagerStock(COMPANY, { period: 'month' }),
        managerService.getManagerActivity(COMPANY, { period: 'month' }),
      ]);

      expect(kpis.kpis).toBeDefined();
      expect(sales.totals).toBeDefined();
      expect(clients.counts).toBeDefined();
      expect(stock.valuation).toBeDefined();
      expect(activity.movements).toBeDefined();
    });
  });

  describe('scoping entreprise', () => {
    it('doit passer companyId dans chaque requête', async () => {
      await managerService.getManagerKpis('company-xyz', { period: 'month' });

      const calls = [
        ...prisma.invoice.aggregate.mock.calls,
        ...prisma.invoice.count.mock.calls,
        ...prisma.movement.aggregate.mock.calls,
        ...prisma.movementItem.findMany.mock.calls,
        ...prisma.product.findMany.mock.calls,
        ...prisma.client.count.mock.calls,
      ];

      expect(calls.length).toBeGreaterThan(0);
      calls.forEach(([args]) => {
        // companyId directement sur le where, ou via la relation (movementItem)
        expect(args.where.companyId ?? args.where.movement?.companyId).toBe('company-xyz');
      });
    });
  });
});