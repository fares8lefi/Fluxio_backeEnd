const prisma = require('../../../config/db');
const exportService = require('../../../src/services/exportService');

jest.mock('../../../config/db', () => ({
  invoice: { findMany: jest.fn() },
  product: { findMany: jest.fn() },
  client: { findMany: jest.fn() },
  movement: { findMany: jest.fn() },
}));

const rows = (csv) =>
  csv
    .replace(/^\uFEFF/, '')
    .trim()
    .split('\r\n')
    .map((r) => r.split(';'));

const sale = (extra = {}) => ({
  id: 'i1',
  date: new Date(2026, 9, 14),
  reference: 'FAC-2026-0003',
  invoice_type: 'SALE',
  status: 'PAID',
  client: { name: 'Medina SA', matriculeFiscale: 'MF' },
  tva_breakdown: JSON.stringify([{ rate: 19, base_ht: 100, tva_amount: 19 }]),
  total_ht: 100,
  tva_amount: 19,
  timbre_fiscal: 1,
  total_ttc: 120,
  ...extra,
});

describe('exportService — exports depuis la base', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('salesJournal', () => {
    it("charge factures et avoirs de la période et résout la facture d'origine", async () => {
      prisma.invoice.findMany
        .mockResolvedValueOnce([
          sale(),
          sale({
            id: 'cn1',
            reference: 'AV-2026-0001',
            invoice_type: 'CREDIT_NOTE',
            original_invoice_id: 'i1',
          }),
        ])
        .mockResolvedValueOnce([{ id: 'i1', reference: 'FAC-2026-0003' }]);

      const { csv, filename } = await exportService.salesJournal('c1', {
        from: '2026-10-01',
        to: '2026-10-31',
      });

      expect(filename).toBe('journal-ventes_01-10-2026_31-10-2026.csv');
      const first = prisma.invoice.findMany.mock.calls[0][0];
      expect(first.where).toMatchObject({
        companyId: 'c1',
        invoice_type: { in: ['SALE', 'CREDIT_NOTE'] },
      });
      expect(prisma.invoice.findMany.mock.calls[1][0].where).toEqual({
        id: { in: ['i1'] },
        companyId: 'c1',
      });
      const lines = rows(csv);
      expect(lines).toHaveLength(3);
      expect(lines[2]).toContain('FAC-2026-0003');
    });

    it('ne cherche pas de facture d’origine sans avoir', async () => {
      prisma.invoice.findMany.mockResolvedValueOnce([sale()]);
      await exportService.salesJournal('c1', { from: '2026-10-01', to: '2026-10-31' });
      expect(prisma.invoice.findMany).toHaveBeenCalledTimes(1);
    });

    it('refuse une période inversée', async () => {
      await expect(
        exportService.salesJournal('c1', { from: '2026-10-31', to: '2026-10-01' })
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('vatSummary', () => {
    it('récapitule le mois demandé', async () => {
      prisma.invoice.findMany.mockResolvedValueOnce([sale()]);
      const { csv, filename } = await exportService.vatSummary('c1', { month: '2026-02' });

      expect(filename).toBe('recap-tva_2026-02.csv');
      const { date } = prisma.invoice.findMany.mock.calls[0][0].where;
      expect(date.gte).toEqual(new Date(2026, 1, 1));
      expect(date.lte.getDate()).toBe(28);
      const lines = rows(csv);
      expect(lines[0]).toEqual(['Période', 'Taux TVA', 'Base HT', 'TVA collectée']);
      expect(lines.find((l) => l[1] === 'Total')).toEqual([
        '02/2026',
        'Total',
        '100,000',
        '19,000',
      ]);
    });

    it('utilise le mois courant par défaut et refuse un mois invalide', async () => {
      prisma.invoice.findMany.mockResolvedValue([]);
      const now = new Date();
      const { filename } = await exportService.vatSummary('c1');
      expect(filename).toBe(
        `recap-tva_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.csv`
      );
      await expect(exportService.vatSummary('c1', { month: '2026-13' })).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  it('products exporte le catalogue avec la valeur du stock', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        code: 1,
        barcode: 619,
        name: 'Huile',
        category: { name: 'Épicerie' },
        supplier: null,
        unit_of_measure: 'L',
        purchase_price: 2.5,
        selling_price: 3.2,
        tva_rate: 19,
        stock_quantity: 4,
        stock_min: 2,
      },
    ]);
    const { csv, filename } = await exportService.products('c1');
    expect(filename).toBe('produits.csv');
    expect(rows(csv)[1]).toEqual([
      '1',
      '619',
      'Huile',
      'Épicerie',
      '',
      'L',
      '2,500',
      '3,200',
      '19',
      '4',
      '2',
      '10,000',
    ]);
  });

  it('clients exporte les tiers et leur statut', async () => {
    prisma.client.findMany.mockResolvedValue([
      { name: 'Medina', matriculeFiscale: 'MF', phone: '71', is_active: true },
      {
        name: 'Sfax',
        matriculeFiscale: 'MF2',
        codeTva: 'T',
        phone: '74',
        address: 'Sfax',
        is_active: false,
      },
    ]);
    const { csv, filename } = await exportService.clients('c1');
    expect(filename).toBe('clients.csv');
    const lines = rows(csv);
    expect(lines[1]).toEqual(['Medina', 'MF', '', '71', '', 'Oui']);
    expect(lines[2]).toEqual(['Sfax', 'MF2', 'T', '74', 'Sfax', 'Non']);
  });

  it('movements produit une ligne par article', async () => {
    prisma.movement.findMany.mockResolvedValue([
      {
        created_at: new Date(2026, 9, 2),
        reference: 'BE-1',
        type: 'IN',
        status: 'CONFIRMED',
        supplier: { name: 'Sotupa' },
        supplier_invoice_ref: 'FA-9',
        supplier_invoice_date: new Date(2026, 9, 1),
        items: [
          { quantity: 2, unit_price: 1.5, product: { code: 1, name: 'Huile' } },
          { quantity: 1, unit_price: 3, product: null },
        ],
      },
      {
        created_at: new Date(2026, 9, 3),
        type: 'WEIRD',
        status: 'CANCELLED',
        supplier_invoice_ref: 'FA-10',
        note: 'casse',
        items: [{ quantity: 1, unit_price: 1, product: { code: 2, name: 'Sucre' } }],
      },
    ]);

    const { csv, filename } = await exportService.movements('c1', {
      from: '2026-10-01',
      to: '2026-10-31',
    });

    expect(filename).toBe('mouvements_01-10-2026_31-10-2026.csv');
    const lines = rows(csv);
    expect(lines).toHaveLength(4);
    expect(lines[1]).toEqual([
      '02/10/2026',
      'BE-1',
      'Entrée',
      'Sotupa',
      '1',
      'Huile',
      '2',
      '1,500',
      '3,000',
      'Confirmé',
      '',
      'FA-9 du 01/10/2026',
    ]);
    expect(lines[2].slice(4, 6)).toEqual(['', '']);
    expect(lines[3]).toEqual([
      '03/10/2026',
      '',
      'WEIRD',
      '',
      '2',
      'Sucre',
      '1',
      '1,000',
      '1,000',
      'Annulé',
      'casse',
      'FA-10',
    ]);
  });
});
