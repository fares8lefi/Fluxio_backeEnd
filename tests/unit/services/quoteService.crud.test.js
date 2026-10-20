jest.mock('../../../src/repositories/quoteRepository');
jest.mock('../../../src/services/mouvmentService');
jest.mock('../../../src/services/invoiceService');
jest.mock('../../../src/repositories/clientRepository', () => ({ getClientByID: jest.fn() }));
const clientRepository = require('../../../src/repositories/clientRepository');
const quoteRepository = require('../../../src/repositories/quoteRepository');
const mouvmentService = require('../../../src/services/mouvmentService');
const invoiceService = require('../../../src/services/invoiceService');
const quoteService = require('../../../src/services/quoteService');

const year = new Date().getFullYear();

describe('quoteService.createQuote', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    quoteRepository.getLastReferenceNumber.mockResolvedValue(3);
    quoteRepository.createQuote.mockImplementation(async (data) => ({ id: 'q1', ...data }));
    clientRepository.getClientByID.mockImplementation(async (id, companyId) =>
      companyId === 'c1' ? { id } : null
    );
  });

  it("refuse un client d'une autre entreprise", async () => {
    clientRepository.getClientByID.mockResolvedValueOnce(null);
    await expect(
      quoteService.createQuote({ clientId: 'autre', items: [] }, 'c1')
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(clientRepository.getClientByID).toHaveBeenCalledWith('autre', 'c1');
    expect(quoteRepository.createQuote).not.toHaveBeenCalled();
  });

  it('calcule les totaux, numérote le devis et le crée en brouillon', async () => {
    const items = [{ name: 'Colle', quantity: 2, unit_price: 10, tva_rate: 19 }];
    const quote = await quoteService.createQuote(
      { clientId: 'k1', items, valid_until: '2026-12-31', notes: 'n' },
      'c1'
    );
    expect(quoteRepository.getLastReferenceNumber).toHaveBeenCalledWith('c1', year);
    expect(quote).toMatchObject({
      reference: `DEV-${year}-0004`,
      status: 'DRAFT',
      total_ht: 20,
      tva_amount: 3.8,
      is_suspended: false,
      items: JSON.stringify(items),
      notes: 'n',
      payment_terms: 'Validité 30 jours',
      valid_until: new Date('2026-12-31'),
      clientId: 'k1',
      companyId: 'c1',
    });
  });

  it('accepte des lignes en JSON et la suspension de TVA en texte', async () => {
    const items = [{ name: 'Colle', quantity: 1, unit_price: 10, tva_rate: 19 }];
    const quote = await quoteService.createQuote(
      { items: JSON.stringify(items), is_suspended: 'true', payment_terms: '15 jours' },
      'c1'
    );
    expect(quote).toMatchObject({
      is_suspended: true,
      tva_amount: 0,
      payment_terms: '15 jours',
      clientId: null,
      valid_until: null,
      notes: null,
    });
  });

  it('ignore des lignes JSON illisibles', async () => {
    const quote = await quoteService.createQuote({ items: '{pas du json' }, 'c1');
    expect(quote.items).toBe('[]');
    expect(quote.total_ht).toBe(0);
  });
});

describe('quoteService lecture', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getAll transmet les filtres', async () => {
    quoteRepository.findAll.mockResolvedValue([{ id: 'q1' }]);
    await expect(quoteService.getAll('c1', { status: 'SENT' })).resolves.toEqual([{ id: 'q1' }]);
    expect(quoteRepository.findAll).toHaveBeenCalledWith('c1', { status: 'SENT' });
    await quoteService.getAll('c1');
    expect(quoteRepository.findAll).toHaveBeenLastCalledWith('c1', {});
  });

  it('getById renvoie le devis ou 404', async () => {
    quoteRepository.getById.mockResolvedValueOnce({ id: 'q1' }).mockResolvedValueOnce(null);
    await expect(quoteService.getById('q1', 'c1')).resolves.toEqual({ id: 'q1' });
    await expect(quoteService.getById('q2', 'c1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('updateStatus accepte un statut valide et refuse les autres', async () => {
    quoteRepository.updateStatus.mockResolvedValue({ id: 'q1', status: 'SENT' });
    await expect(quoteService.updateStatus('q1', 'SENT', 'c1')).resolves.toEqual({
      id: 'q1',
      status: 'SENT',
    });
    await expect(quoteService.updateStatus('q1', 'PAID', 'c1')).rejects.toThrow('Statut invalide');
  });
});

describe('quoteService.convertToInvoice — cas limites', () => {
  const user = { id: 'u1', companyId: 'c1' };

  beforeEach(() => jest.clearAllMocks());

  it('renvoie 404 pour un devis inconnu', async () => {
    quoteRepository.getById.mockResolvedValue(null);
    await expect(quoteService.convertToInvoice('q1', user)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('refuse un devis sans ligne (ou aux lignes illisibles)', async () => {
    quoteRepository.getById.mockResolvedValue({ id: 'q1', status: 'ACCEPTED', items: 'oops' });
    await expect(quoteService.convertToInvoice('q1', user)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Le devis ne contient aucune ligne',
    });
  });

  it("propage l'erreur de facture même si l'annulation du mouvement échoue", async () => {
    quoteRepository.getById.mockResolvedValue({
      id: 'q1',
      reference: 'DEV-1',
      status: 'ACCEPTED',
      clientId: 'k1',
      client: { name: 'Medina SA', matriculeFiscale: '7654321B/A/M/000', address: 'Sfax' },
      company: { name: 'Atlas', matriculeFiscale: '1234567A/A/M/000', address: 'Tunis' },
      items: JSON.stringify([
        { productId: 'p1', name: 'Colle', quantity: 1, unit_price: 10, tva_rate: 19 },
      ]),
    });
    mouvmentService.createMouvment.mockResolvedValue({ id: 'm1' });
    invoiceService.generateInvoiceFromMovement.mockRejectedValue(new Error('facture KO'));
    mouvmentService.cancelMouvment.mockRejectedValue(new Error('annulation KO'));

    await expect(quoteService.convertToInvoice('q1', user)).rejects.toThrow('facture KO');
    expect(mouvmentService.cancelMouvment).toHaveBeenCalledWith('m1', 'c1');
    expect(quoteRepository.updateStatus).not.toHaveBeenCalled();
  });
});
