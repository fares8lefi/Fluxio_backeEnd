jest.mock('../../../src/repositories/quoteRepository');
jest.mock('../../../src/services/mouvmentService');
jest.mock('../../../src/services/invoiceService');
const quoteRepository = require('../../../src/repositories/quoteRepository');
const mouvmentService = require('../../../src/services/mouvmentService');
const invoiceService = require('../../../src/services/invoiceService');
const quoteService = require('../../../src/services/quoteService');

const user = { id: 'u1', companyId: 'c1' };
const company = { id: 'c1', name: 'Atlas', matriculeFiscale: '1234567A/A/M/000', address: 'Tunis' };
const client = { id: 'k1', name: 'Medina SA', matriculeFiscale: '7654321B/A/M/000' };
const baseQuote = {
  id: 'q1',
  reference: 'DEV-2026-0004',
  status: 'ACCEPTED',
  invoice_id: null,
  is_suspended: false,
  payment_terms: 'Validité 30 jours',
  clientId: 'k1',
  client,
  company,
  items: JSON.stringify([
    { productId: 'p1', name: 'Carrelage', quantity: 85, unit_price: 32, tva_rate: 19, discount: 5 },
    { productId: 'p2', name: 'Colle', quantity: 30, unit_price: 18.75, tva_rate: 19, discount: 0 },
  ]),
};

describe('quoteService.convertToInvoice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    quoteRepository.getById.mockResolvedValue({ ...baseQuote });
    mouvmentService.createMouvment.mockResolvedValue({ id: 'm1' });
    mouvmentService.cancelMouvment.mockResolvedValue({});
    invoiceService.generateInvoiceFromMovement.mockResolvedValue({
      id: 'i1',
      reference: 'FAC-2026-0005',
    });
    quoteRepository.updateStatus.mockImplementation(async (id, status, companyId, extra) => ({
      id,
      status,
      ...extra,
    }));
  });

  it('crée la sortie de stock (remise intégrée), la facture, puis lie le devis', async () => {
    const result = await quoteService.convertToInvoice('q1', user);

    expect(mouvmentService.createMouvment).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'OUT',
        clientId: 'k1',
        reference: 'DEV-2026-0004',
        items: [
          { productId: 'p1', quantity: 85, unit_price: 30.4, tva_rate: 19 }, // 32 − 5 %
          { productId: 'p2', quantity: 30, unit_price: 18.75, tva_rate: 19 },
        ],
      }),
      user,
      { keepTvaRate: true } // la facture reprend le taux du devis
    );
    expect(invoiceService.generateInvoiceFromMovement).toHaveBeenCalledWith(
      'm1',
      'c1',
      expect.objectContaining({ is_suspended: false })
    );
    expect(quoteRepository.updateStatus).toHaveBeenCalledWith('q1', 'CONVERTED', 'c1', {
      invoice_id: 'i1',
    });
    expect(result.invoice.reference).toBe('FAC-2026-0005');
  });

  it('refuse un devis non accepté sans toucher au stock', async () => {
    quoteRepository.getById.mockResolvedValue({ ...baseQuote, status: 'SENT' });
    await expect(quoteService.convertToInvoice('q1', user)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mouvmentService.createMouvment).not.toHaveBeenCalled();
  });

  it('refuse un devis déjà converti', async () => {
    quoteRepository.getById.mockResolvedValue({ ...baseQuote, invoice_id: 'i0' });
    await expect(quoteService.convertToInvoice('q1', user)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('refuse les lignes libres (sans produit du catalogue)', async () => {
    quoteRepository.getById.mockResolvedValue({
      ...baseQuote,
      items: JSON.stringify([{ name: "Main d'œuvre", quantity: 1, unit_price: 100, tva_rate: 19 }]),
    });
    await expect(quoteService.convertToInvoice('q1', user)).rejects.toThrow(/Main d'œuvre/);
    expect(mouvmentService.createMouvment).not.toHaveBeenCalled();
  });

  it('vérifie les mentions obligatoires avant de décrémenter le stock', async () => {
    quoteRepository.getById.mockResolvedValue({
      ...baseQuote,
      company: { ...company, matriculeFiscale: null },
    });
    await expect(quoteService.convertToInvoice('q1', user)).rejects.toMatchObject({
      statusCode: 400,
      missing_fields: [expect.objectContaining({ scope: 'company', field: 'matriculeFiscale' })],
    });
    expect(mouvmentService.createMouvment).not.toHaveBeenCalled();
  });

  it('annule la sortie de stock si la facture échoue (compensation)', async () => {
    invoiceService.generateInvoiceFromMovement.mockRejectedValue(new Error('panne'));
    await expect(quoteService.convertToInvoice('q1', user)).rejects.toThrow('panne');
    expect(mouvmentService.cancelMouvment).toHaveBeenCalledWith('m1', 'c1');
    expect(quoteRepository.updateStatus).not.toHaveBeenCalled();
  });

  it("exige l'attestation pour un devis en suspension de TVA", async () => {
    quoteRepository.getById.mockResolvedValue({ ...baseQuote, is_suspended: true });
    await expect(quoteService.convertToInvoice('q1', user)).rejects.toThrow(/attestation/);
  });
});

describe('quoteService.updateStatus', () => {
  it('interdit le passage manuel à CONVERTED', async () => {
    await expect(quoteService.updateStatus('q1', 'CONVERTED', 'c1')).rejects.toThrow(/conversion/);
  });
});
