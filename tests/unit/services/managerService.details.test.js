const managerService = require('../../../src/services/managerService');
const prisma = require('../../../config/db');

jest.mock('../../../config/db', () => ({
  invoice: { aggregate: jest.fn(), count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
  movement: { aggregate: jest.fn(), count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
  movementItem: { aggregate: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
  product: { findMany: jest.fn(), count: jest.fn() },
  category: { findMany: jest.fn() },
  client: { findMany: jest.fn(), count: jest.fn() },
  supplier: { findMany: jest.fn() },
  quote: { aggregate: jest.fn(), count: jest.fn() },
  payment: { aggregate: jest.fn(), findMany: jest.fn() },
}));

const COMPANY = 'company-1';
const emptyAggregate = { _sum: {}, _count: { _all: 0 } };
const daysAgo = (days) => new Date(Date.now() - days * 86400000);

const resetPrisma = () => {
  for (const model of Object.values(prisma)) {
    for (const fn of Object.values(model)) fn.mockReset();
  }
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
  prisma.payment.aggregate.mockResolvedValue({ _sum: {} });
  prisma.payment.findMany.mockResolvedValue([]);
  managerService.clearCache();
};

describe('managerService — classements et séries', () => {
  beforeEach(resetPrisma);

  it('getManagerSales trie la TVA par taux, remplit la série 12 mois et la part des top clients', async () => {
    prisma.invoice.findMany.mockImplementation(async ({ select }) => {
      if (select?.tva_breakdown) {
        return [
          {
            date: daysAgo(2),
            invoice_type: 'SALE',
            is_suspended: false,
            total_ht: 300,
            total_ttc: 364,
            tva_amount: 64,
            tva_breakdown: JSON.stringify([
              { rate: 19, base_ht: 200, tva_amount: 38 },
              { rate: 7, base_ht: 100, tva_amount: 7 },
              { rate: 'x', base_ht: 1, tva_amount: 1 },
            ]),
          },
        ];
      }
      if (select?.total_ttc && select?.date && !select?.clientId) {
        return [
          { date: daysAgo(2), total_ht: 300, total_ttc: 364, tva_amount: 64 },
          { date: new Date('1990-01-01'), total_ht: 1, total_ttc: 1, tva_amount: 0 },
        ];
      }
      return [];
    });
    prisma.invoice.groupBy.mockImplementation(async ({ _sum }) =>
      _sum
        ? [
            { clientId: 'k1', _sum: { total_ttc: 273 } },
            { clientId: 'k2', _sum: { total_ttc: 91 } },
          ]
        : [{ clientId: 'k1', _count: { _all: 2 } }]
    );
    prisma.client.findMany.mockResolvedValue([
      { id: 'k1', name: 'Medina', matriculeFiscale: 'MF' },
    ]);

    const res = await managerService.getManagerSales(COMPANY, { period: '30d' });

    expect(res.tva_by_rate.map((r) => r.rate)).toEqual([7, 19]);
    const current = res.trend.at(-1);
    expect(current).toMatchObject({ billed_ttc: 364, billed_ht: 300, tva: 64 });
    expect(res.top_clients).toEqual([
      expect.objectContaining({ id: 'k1', name: 'Medina', invoice_count: 2, share_pct: 75 }),
      expect.objectContaining({
        id: 'k2',
        name: 'Client supprimé',
        invoice_count: 0,
        share_pct: 25,
      }),
    ]);
  });

  it('getManagerClients classe les clients à risque par encours décroissant', async () => {
    prisma.invoice.findMany.mockImplementation(async ({ where }) =>
      where.status?.in
        ? [
            { date: daysAgo(90), clientId: 'k1', total_ttc: 100, amount_paid: 0 },
            { date: daysAgo(120), clientId: 'k2', total_ttc: 500, amount_paid: 100 },
            { date: daysAgo(200), clientId: 'k1', total_ttc: 50, amount_paid: 0 },
            { date: daysAgo(5), clientId: 'k3', total_ttc: 999, amount_paid: 0 },
          ]
        : []
    );
    prisma.client.findMany.mockResolvedValue([{ id: 'k2', name: 'Sfax Distribution' }]);

    const res = await managerService.getManagerClients(COMPANY, { period: '30d' });

    expect(res.at_risk.map((r) => [r.id, r.name, r.outstanding_ttc])).toEqual([
      ['k2', 'Sfax Distribution', 400],
      ['k1', 'Client supprimé', 150],
    ]);
    expect(res.at_risk[1].days_overdue).toBeGreaterThanOrEqual(199);
  });

  it('getManagerStock trie les marges faibles, nomme les fournisseurs et retire les avoirs', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'A',
        stock_quantity: 1,
        purchase_price: 9.5,
        selling_price: 10,
        categoryId: 'k1',
      },
      { id: 'p2', name: 'B', stock_quantity: 1, purchase_price: 9.8, selling_price: 10 },
      { id: 'p3', name: 'C', stock_quantity: 1, purchase_price: 5, selling_price: 10 },
    ]);
    prisma.category.findMany.mockResolvedValue([{ id: 'k1', name: 'Épicerie' }]);
    prisma.movement.groupBy.mockResolvedValue([
      { supplierId: 's1', _sum: { total_amount: 800 }, _count: { _all: 2 } },
      { supplierId: 's2', _sum: { total_amount: 100 }, _count: { _all: 1 } },
    ]);
    prisma.supplier.findMany.mockResolvedValue([{ id: 's1', name: 'Sotupa' }]);
    const line = { quantity: 2, unit_price: 10, purchase_price: 5, product: { categoryId: 'k1' } };
    prisma.invoice.findMany.mockImplementation(async ({ where }) => {
      if (where.id?.in) return [{ movement: { items: [{ ...line, quantity: 1 }] } }];
      if (where.invoice_type === 'CREDIT_NOTE') return [{ original_invoice_id: 'i1' }];
      if (where.invoice_type === 'SALE') return [{ movement: { items: [line] } }];
      return [];
    });

    const res = await managerService.getManagerStock(COMPANY, { period: '30d' });

    expect(res.low_margin_products.map((p) => p.id)).toEqual(['p2', 'p1']);
    expect(res.top_suppliers).toEqual([
      { id: 's1', name: 'Sotupa', purchased_total: 800, movement_count: 2 },
      { id: 's2', name: 'Fournisseur supprimé', purchased_total: 100, movement_count: 1 },
    ]);
    const epicerie = res.by_category.find((c) => c.category === 'Épicerie');
    expect(epicerie).toMatchObject({ sales_ht: 10, margin: 5 });
    const creditQuery = prisma.invoice.findMany.mock.calls.find(([q]) => q.where.id?.in);
    expect(creditQuery[0].where).toEqual({ companyId: COMPANY, id: { in: ['i1'] } });
  });

  it('getManagerActivity classe les produits vendus par CA HT', async () => {
    prisma.movementItem.findMany.mockResolvedValue([
      { quantity: 1, unit_price: 5, product: { name: 'Sucre' } },
      { quantity: 2, unit_price: 50, product: { name: 'Huile' } },
      { quantity: 3, unit_price: 5, product: { name: 'Sucre' } },
      { quantity: 1, unit_price: 1, product: null },
    ]);

    const res = await managerService.getManagerActivity(COMPANY, { period: '30d' });

    expect(res.top_products).toEqual([
      { name: 'Huile', quantity: 2, revenue_ht: 100 },
      { name: 'Sucre', quantity: 4, revenue_ht: 20 },
      { name: 'Produit', quantity: 1, revenue_ht: 1 },
    ]);
  });
});
