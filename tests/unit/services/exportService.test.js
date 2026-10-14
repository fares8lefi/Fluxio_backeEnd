const exportService = require('../../../src/services/exportService');

jest.mock('../../../config/db', () => ({}));

const sale = (extra = {}) => ({
  date: new Date('2026-10-14'),
  reference: 'FAC-2026-0003',
  invoice_type: 'SALE',
  status: 'PAID',
  client: { name: 'Medina SA', matriculeFiscale: '7654321B/A/M/000' },
  tva_breakdown: JSON.stringify([
    { rate: 7, base_ht: 293.4, tva_amount: 20.538 },
    { rate: 19, base_ht: 2990, tva_amount: 568.1 },
  ]),
  total_ht: 3283.4,
  tva_amount: 588.638,
  timbre_fiscal: 1,
  total_ttc: 3873.038,
  rs_amount: 38.73,
  net_payable: 3834.308,
  amount_paid: 3834.308,
  is_suspended: false,
  ...extra,
});

const rows = (csv) =>
  csv
    .replace(/^\uFEFF/, '')
    .trim()
    .split('\r\n')
    .map((l) => l.split(';'));

describe('exportService', () => {
  it('formate les montants à la française (virgule, 3 décimales)', () => {
    expect(exportService.money(1234.5)).toBe('1234,500');
    expect(exportService.money(-0.1)).toBe('-0,100');
  });

  it('protège le tableur : guillemets et formules neutralisées', () => {
    expect(exportService.cell('Dupont; fils')).toBe('"Dupont; fils"');
    expect(exportService.cell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(exportService.cell('-12,5')).toBe('-12,5'); // un nombre négatif reste un nombre
  });

  it('commence par un BOM UTF-8 pour Excel', () => {
    expect(exportService.toCsv(['a'], [['é']]).charCodeAt(0)).toBe(0xfeff);
  });

  it('journal des ventes : bases et TVA par taux, avoir négatif, annulée à zéro', () => {
    const csv = exportService.buildSalesJournal([
      sale(),
      sale({
        reference: 'AVO-2026-0001',
        invoice_type: 'CREDIT_NOTE',
        status: 'PENDING',
        total_ttc: -3872.038,
        timbre_fiscal: 0,
        originalReference: 'FAC-2026-0003',
      }),
      sale({ reference: 'FAC-2026-0004', status: 'CANCELLED' }),
    ]);
    const [header, facture, avoir, annulee] = rows(csv);
    const col = (name) => header.indexOf(name);

    expect(facture[col('Base HT 7 %')]).toBe('293,400');
    expect(facture[col('TVA 19 %')]).toBe('568,100');
    expect(facture[col('Net à payer')]).toBe('3834,308');
    expect(avoir[col('Type')]).toBe('Avoir');
    expect(avoir[col('Base HT 19 %')]).toBe('-2990,000');
    expect(avoir[col("Facture d'origine")]).toBe('FAC-2026-0003');
    expect(annulee[col('Statut')]).toBe('Annulée');
    expect(annulee[col('Total TTC')]).toBe('0,000');
  });

  it('récap TVA : factures − avoirs, annulées exclues ; total = somme des taux', () => {
    const summary = exportService.computeVatSummary([
      sale(),
      sale(),
      sale({ invoice_type: 'CREDIT_NOTE', timbre_fiscal: 0 }),
      sale({ status: 'CANCELLED' }),
    ]);
    const rate = (r) => summary.lines.find((l) => l.rate === r);
    expect(rate(19)).toEqual({ rate: 19, base_ht: 2990, tva: 568.1 });
    expect(rate(7).tva).toBe(20.538);
    expect(summary.total_tva).toBe(588.638);
    expect(summary.timbre).toBe(2);
    expect(summary.invoice_count).toBe(3);
  });
});

describe('exportService.resolveRange', () => {
  it('interprète AAAA-MM-JJ en heure locale, fin de journée incluse', () => {
    const { start, end } = exportService.resolveRange('2026-10-01', '2026-10-31');
    expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours()]).toEqual([
      2026, 9, 1, 0,
    ]);
    expect([end.getDate(), end.getHours(), end.getMinutes()]).toEqual([31, 23, 59]);
  });

  it('refuse une période inversée', () => {
    expect(() => exportService.resolveRange('2026-10-31', '2026-10-01')).toThrow(/précéder/);
  });
});
