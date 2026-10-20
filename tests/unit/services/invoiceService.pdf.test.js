jest.mock('../../../src/repositories/invoiceRepository', () => ({ getInvoiceById: jest.fn() }));
jest.mock('../../../src/repositories/mouvmentRepository', () => ({}));
jest.mock('../../../src/repositories/clientRepository', () => ({}));
jest.mock('../../../src/repositories/companyRepository', () => ({}));
const invoiceRepository = require('../../../src/repositories/invoiceRepository');
const invoiceService = require('../../../src/services/invoiceService');

const movement = {
  reference: 'BS-0001',
  items: [
    {
      quantity: 2,
      unit_price: 50,
      tva_rate: 7,
      product: { code: 11, name: 'Colle', unit_of_measure: 'kg', tva_rate: 19 },
    },
    { quantity: 1, unit_price: 100, product: null },
  ],
};

const sale = (extra = {}) => ({
  id: 'i1',
  reference: 'FAC-2026-0001',
  invoice_type: 'SALE',
  date: new Date('2026-10-01'),
  status: 'PENDING',
  total_ht: 200,
  tva_amount: 26,
  timbre_fiscal: 1,
  total_ttc: 227,
  net_payable: null,
  tva_breakdown: JSON.stringify([
    { rate: 7, base_ht: 100, tva_amount: 7 },
    { rate: 19, base_ht: 100, tva_amount: 19 },
  ]),
  company: { name: 'Atlas', matriculeFiscale: '1234567A/A/M/000' },
  client: { name: 'Medina SA', address: 'Sfax' },
  movement,
  ...extra,
});

describe('invoiceService.getInvoicePdfData', () => {
  beforeEach(() => jest.clearAllMocks());

  it('échoue pour une facture inconnue', async () => {
    invoiceRepository.getInvoiceById.mockResolvedValue(null);
    await expect(invoiceService.getInvoicePdfData('i1', 'c1')).rejects.toThrow(
      'Facture introuvable'
    );
  });

  it('assemble les lignes, la ventilation TVA et le montant en lettres', async () => {
    invoiceRepository.getInvoiceById.mockResolvedValue(sale());
    const data = await invoiceService.getInvoicePdfData('i1', 'c1');

    expect(data.items).toEqual([
      {
        productCode: 11,
        productName: 'Colle',
        unitOfMeasure: 'kg',
        quantity: 2,
        unitPriceHT: 50,
        tvaRate: 7,
        totalLineHT: 100,
      },
      {
        productCode: null,
        productName: 'Produit',
        unitOfMeasure: null,
        quantity: 1,
        unitPriceHT: 100,
        tvaRate: 19,
        totalLineHT: 100,
      },
    ]);
    expect(data.fiscalSummary.tva_breakdown).toHaveLength(2);
    expect(data.fiscalSummary).toMatchObject({
      net_payable: 227,
      apply_rs: false,
      rs_rate: 1,
      rs_amount: 0,
      amountInWords: expect.any(String),
    });
    expect(data.company).toEqual({
      name: 'Atlas',
      matriculeFiscale: '1234567A/A/M/000',
      address: null,
      phone: null,
    });
    expect(data.client).toMatchObject({ name: 'Medina SA', address: 'Sfax', codeTva: null });
    expect(data.invoiceDetails).toMatchObject({
      movement_reference: 'BS-0001',
      original_invoice: null,
      is_suspended: false,
    });
  });

  it("calcule une ventilation par défaut pour les anciennes factures et accepte l'absence de client", async () => {
    invoiceRepository.getInvoiceById.mockResolvedValue(
      sale({ tva_breakdown: 'illisible', client: null, movement: null })
    );
    const data = await invoiceService.getInvoicePdfData('i1', 'c1');
    expect(data.fiscalSummary.tva_breakdown).toEqual([{ rate: 19, base_ht: 200, tva_amount: 26 }]);
    expect(data.client).toBeNull();
    expect(data.items).toEqual([]);
  });

  it("un avoir reprend en négatif les lignes de la facture d'origine", async () => {
    const original = sale();
    const creditNote = sale({
      id: 'cn1',
      reference: 'AV-2026-0001',
      invoice_type: 'CREDIT_NOTE',
      original_invoice_id: 'i1',
      movement: null,
      total_ht: -200,
      tva_amount: -26,
      total_ttc: -226,
    });
    invoiceRepository.getInvoiceById.mockImplementation(async (id) =>
      id === 'cn1' ? creditNote : original
    );

    const data = await invoiceService.getInvoicePdfData('cn1', 'c1');

    expect(invoiceRepository.getInvoiceById).toHaveBeenCalledWith('i1', 'c1');
    expect(data.items.map((i) => i.totalLineHT)).toEqual([-100, -100]);
    expect(data.fiscalSummary.tva_breakdown).toEqual([
      { rate: 7, base_ht: -100, tva_amount: -7 },
      { rate: 19, base_ht: -100, tva_amount: -19 },
    ]);
    expect(data.invoiceDetails.original_invoice).toEqual({
      reference: 'FAC-2026-0001',
      date: original.date,
    });
    expect(data.invoiceDetails.movement_reference).toBe('BS-0001');
  });
});
