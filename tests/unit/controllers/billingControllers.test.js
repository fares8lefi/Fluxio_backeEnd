jest.mock('../../../src/services/invoiceService');
jest.mock('../../../src/services/paymentService');
jest.mock('../../../src/services/quoteService');
jest.mock('../../../src/services/managerService');
const invoiceService = require('../../../src/services/invoiceService');
const paymentService = require('../../../src/services/paymentService');
const quoteService = require('../../../src/services/quoteService');
const managerService = require('../../../src/services/managerService');
const invoiceController = require('../../../src/controllers/invoiceController');
const paymentController = require('../../../src/controllers/paymentController');
const quoteController = require('../../../src/controllers/quoteController');
const managerController = require('../../../src/controllers/managerController');
const { mockReq, mockRes, httpError } = require('../helpers/http');

const user = { id: 'u1', companyId: 'c1', role: 'user' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

const call = async (controller, handler, req) => {
  const res = mockRes();
  await controller[handler](mockReq(req), res);
  return res;
};

describe('invoiceController', () => {
  it('getMovementsForInvoice convertit les filtres de requête', async () => {
    invoiceService.getMovementsForInvoice.mockResolvedValue({ movements: [], total: 0 });
    const res = await call(invoiceController, 'getMovementsForInvoice', {
      query: {
        page: '2',
        movementId: 'm1',
        clientId: 'k1',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        search: 'med',
        onlyNotInvoiced: 'true',
        onlyInvoiced: 'false',
      },
    });
    expect(invoiceService.getMovementsForInvoice).toHaveBeenCalledWith('2', 'c1', {
      movementId: 'm1',
      clientId: 'k1',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      search: 'med',
      onlyNotInvoiced: true,
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, movements: [], total: 0 });

    await call(invoiceController, 'getMovementsForInvoice', { query: { onlyInvoiced: 'true' } });
    expect(invoiceService.getMovementsForInvoice).toHaveBeenLastCalledWith(1, 'c1', {
      onlyInvoiced: true,
    });

    invoiceService.getMovementsForInvoice.mockRejectedValueOnce(httpError('Refusé', 403));
    expect(
      (await call(invoiceController, 'getMovementsForInvoice', {})).status
    ).toHaveBeenCalledWith(403);
    invoiceService.getMovementsForInvoice.mockRejectedValueOnce(new Error('db'));
    expect(
      (await call(invoiceController, 'getMovementsForInvoice', {})).status
    ).toHaveBeenCalledWith(500);
  });

  describe('generateInvoice', () => {
    it('exige movementId', async () => {
      const res = await call(invoiceController, 'generateInvoice', { body: {} });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(invoiceService.generateInvoiceFromMovement).not.toHaveBeenCalled();
    });

    it('convertit les options (booléens texte, taux de retenue)', async () => {
      invoiceService.generateInvoiceFromMovement.mockResolvedValue({ id: 'i1' });
      const res = await call(invoiceController, 'generateInvoice', {
        body: {
          movementId: 'm1',
          is_suspended: 'true',
          apply_rs: true,
          rs_rate: '1.5',
          attestation_ref: 'ATT',
          allow_incomplete: 'true',
          clientId: 'k1',
        },
      });
      expect(invoiceService.generateInvoiceFromMovement).toHaveBeenCalledWith(
        'm1',
        'c1',
        expect.objectContaining({
          is_suspended: true,
          apply_rs: true,
          rs_rate: 1.5,
          attestation_ref: 'ATT',
          allow_incomplete: true,
          clientId: 'k1',
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);

      await call(invoiceController, 'generateInvoice', { body: { movementId: 'm1' } });
      expect(invoiceService.generateInvoiceFromMovement.mock.calls[1][2]).toMatchObject({
        is_suspended: false,
        apply_rs: false,
        rs_rate: 1,
        allow_incomplete: false,
      });
    });

    it('renvoie les champs manquants et les détails', async () => {
      invoiceService.generateInvoiceFromMovement.mockRejectedValueOnce(
        httpError('Informations manquantes', 400, {
          missing_fields: [{ field: 'matriculeFiscale' }],
          details: { a: 1 },
        })
      );
      let res = await call(invoiceController, 'generateInvoice', { body: { movementId: 'm1' } });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          missing_fields: [{ field: 'matriculeFiscale' }],
          details: { a: 1 },
        })
      );

      invoiceService.generateInvoiceFromMovement.mockRejectedValueOnce(new Error('db'));
      res = await call(invoiceController, 'generateInvoice', { body: { movementId: 'm1' } });
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  it('getInvoiceDataForPdf renvoie les données ou 404', async () => {
    invoiceService.getInvoicePdfData.mockResolvedValueOnce({ items: [] });
    let res = await call(invoiceController, 'getInvoiceDataForPdf', { params: { id: 'i1' } });
    expect(invoiceService.getInvoicePdfData).toHaveBeenCalledWith('i1', 'c1');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { items: [] } });

    invoiceService.getInvoicePdfData.mockRejectedValueOnce(new Error('Facture introuvable'));
    res = await call(invoiceController, 'getInvoiceDataForPdf', { params: { id: 'i1' } });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('getAllInvoices ne transmet que les filtres renseignés', async () => {
    invoiceService.getAllInvoices.mockResolvedValue({ invoices: [], total: 0 });
    await call(invoiceController, 'getAllInvoices', {
      query: {
        page: '3',
        status: 'PAID',
        clientId: 'k1',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        invoice_type: 'SALE',
      },
    });
    expect(invoiceService.getAllInvoices).toHaveBeenCalledWith('3', 'c1', {
      status: 'PAID',
      clientId: 'k1',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      invoice_type: 'SALE',
    });
    await call(invoiceController, 'getAllInvoices', {});
    expect(invoiceService.getAllInvoices).toHaveBeenLastCalledWith(1, 'c1', {});

    invoiceService.getAllInvoices.mockRejectedValueOnce(new Error('db'));
    expect((await call(invoiceController, 'getAllInvoices', {})).status).toHaveBeenCalledWith(500);
  });

  it('updateInvoiceStatus met à jour ou renvoie 400 par défaut', async () => {
    invoiceService.updateInvoiceStatus.mockResolvedValueOnce({ id: 'i1', status: 'PAID' });
    let res = await call(invoiceController, 'updateInvoiceStatus', {
      params: { id: 'i1' },
      body: { status: 'PAID' },
    });
    expect(invoiceService.updateInvoiceStatus).toHaveBeenCalledWith('i1', 'PAID', 'c1');
    expect(res.status).toHaveBeenCalledWith(200);

    invoiceService.updateInvoiceStatus.mockRejectedValueOnce(new Error('Statut invalide'));
    res = await call(invoiceController, 'updateInvoiceStatus', { params: { id: 'i1' } });
    expect(res.status).toHaveBeenCalledWith(400);

    invoiceService.updateInvoiceStatus.mockRejectedValueOnce(httpError('introuvable', 404));
    res = await call(invoiceController, 'updateInvoiceStatus', { params: { id: 'i1' } });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('createCreditNote crée un avoir ou propage l’erreur', async () => {
    invoiceService.createCreditNote.mockResolvedValueOnce({ id: 'cn1' });
    let res = await call(invoiceController, 'createCreditNote', {
      params: { id: 'i1' },
      body: { reason: 'retour' },
    });
    expect(invoiceService.createCreditNote).toHaveBeenCalledWith('i1', 'c1', 'retour');
    expect(res.status).toHaveBeenCalledWith(201);

    invoiceService.createCreditNote.mockRejectedValueOnce(httpError('Déjà un avoir', 409));
    res = await call(invoiceController, 'createCreditNote', { params: { id: 'i1' } });
    expect(res.status).toHaveBeenCalledWith(409);
    invoiceService.createCreditNote.mockRejectedValueOnce(new Error('db'));
    res = await call(invoiceController, 'createCreditNote', { params: { id: 'i1' } });
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('paymentController', () => {
  it.each([
    ['listPayments', { params: { id: 'i1' } }, ['i1', 'c1'], 200],
    [
      'addPayment',
      { params: { id: 'i1' }, body: { amount: 10 } },
      ['i1', 'c1', { amount: 10 }],
      201,
    ],
    ['deletePayment', { params: { paymentId: 'p1' } }, ['p1', 'c1'], 200],
  ])('%s', async (handler, req, args, status) => {
    paymentService[handler].mockResolvedValueOnce({ invoice: { id: 'i1' }, payments: [] });
    let res = await call(paymentController, handler, req);
    expect(paymentService[handler]).toHaveBeenCalledWith(...args);
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, invoice: { id: 'i1' }, payments: [] })
    );

    paymentService[handler].mockRejectedValueOnce(
      httpError('Règlement invalide', 400, { details: { amount: 'requis' } })
    );
    res = await call(paymentController, handler, req);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ errors: { amount: 'requis' } })
    );

    paymentService[handler].mockRejectedValueOnce(new Error('db'));
    res = await call(paymentController, handler, { ...req, user: undefined, session: { user } });
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('quoteController', () => {
  it('createQuote crée le devis ou renvoie 400', async () => {
    quoteService.createQuote.mockResolvedValueOnce({ id: 'q1' });
    let res = await call(quoteController, 'createQuote', { body: { items: [] } });
    expect(quoteService.createQuote).toHaveBeenCalledWith({ items: [] }, 'c1');
    expect(res.status).toHaveBeenCalledWith(201);

    quoteService.createQuote.mockRejectedValueOnce(new Error('Taux invalide'));
    res = await call(quoteController, 'createQuote', {});
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('getAllQuotes filtre et compte', async () => {
    quoteService.getAll.mockResolvedValueOnce([{ id: 'q1' }]);
    let res = await call(quoteController, 'getAllQuotes', {
      query: { status: 'SENT', clientId: 'k1', other: 'x' },
    });
    expect(quoteService.getAll).toHaveBeenCalledWith('c1', { status: 'SENT', clientId: 'k1' });
    expect(res.json).toHaveBeenCalledWith({ success: true, quotes: [{ id: 'q1' }], count: 1 });

    quoteService.getAll.mockRejectedValueOnce(new Error('db'));
    res = await call(quoteController, 'getAllQuotes', {});
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('getQuoteById renvoie le devis ou 404', async () => {
    quoteService.getById.mockResolvedValueOnce({ id: 'q1' });
    let res = await call(quoteController, 'getQuoteById', { params: { id: 'q1' } });
    expect(res.json).toHaveBeenCalledWith({ success: true, quote: { id: 'q1' } });
    quoteService.getById.mockRejectedValueOnce(new Error('Devis introuvable'));
    res = await call(quoteController, 'getQuoteById', { params: { id: 'q1' } });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('updateQuoteStatus met à jour ou renvoie 400', async () => {
    quoteService.updateStatus.mockResolvedValueOnce({ id: 'q1', status: 'SENT' });
    let res = await call(quoteController, 'updateQuoteStatus', {
      params: { id: 'q1' },
      body: { status: 'SENT' },
    });
    expect(quoteService.updateStatus).toHaveBeenCalledWith('q1', 'SENT', 'c1');
    expect(res.status).toHaveBeenCalledWith(200);
    quoteService.updateStatus.mockRejectedValueOnce(new Error('Statut invalide'));
    res = await call(quoteController, 'updateQuoteStatus', { params: { id: 'q1' }, body: {} });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  describe('convertQuote', () => {
    it('convertit le devis et annonce la référence de facture', async () => {
      quoteService.convertToInvoice.mockResolvedValueOnce({
        quote: { id: 'q1' },
        invoice: { id: 'i1', reference: 'FAC-2026-0009' },
        movement: { id: 'm1' },
      });
      const res = await call(quoteController, 'convertQuote', {
        params: { id: 'q1' },
        body: { apply_rs: true },
      });
      expect(quoteService.convertToInvoice).toHaveBeenCalledWith('q1', user, { apply_rs: true });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Facture FAC-2026-0009 créée à partir du devis' })
      );
    });

    it('transmet un corps vide par défaut', async () => {
      quoteService.convertToInvoice.mockResolvedValueOnce({ invoice: { reference: 'F' } });
      await call(quoteController, 'convertQuote', { params: { id: 'q1' }, body: undefined });
      expect(quoteService.convertToInvoice).toHaveBeenCalledWith('q1', user, {});
    });

    it('renvoie champs manquants et erreurs', async () => {
      quoteService.convertToInvoice.mockRejectedValueOnce(
        httpError('Informations manquantes', 400, {
          missing_fields: ['mf'],
          details: { x: 1 },
        })
      );
      let res = await call(quoteController, 'convertQuote', { params: { id: 'q1' } });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ missing_fields: ['mf'], errors: { x: 1 } })
      );
      quoteService.convertToInvoice.mockRejectedValueOnce(new Error('db'));
      res = await call(quoteController, 'convertQuote', { params: { id: 'q1' } });
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});

describe('managerController', () => {
  it.each([
    ['getKpis', 'getManagerKpis'],
    ['getSales', 'getManagerSales'],
    ['getClients', 'getManagerClients'],
    ['getStock', 'getManagerStock'],
    ['getActivity', 'getManagerActivity'],
  ])('%s → managerService.%s pour la société de session', async (handler, serviceFn) => {
    managerService[serviceFn].mockResolvedValueOnce({ ok: 1 });
    const res = await call(managerController, handler, {
      query: { period: '30d', companyId: 'pirate' },
    });
    expect(managerService[serviceFn]).toHaveBeenCalledWith('c1', {
      period: '30d',
      companyId: 'pirate',
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { ok: 1 } });
  });

  it('refuse un utilisateur sans entreprise', async () => {
    const res = await call(managerController, 'getKpis', { user: { id: 'u1', companyId: null } });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(managerService.getManagerKpis).not.toHaveBeenCalled();
  });

  it('remonte les 4xx et masque le détail des 500', async () => {
    managerService.getManagerSales.mockRejectedValueOnce(httpError('Période invalide', 400));
    let res = await call(managerController, 'getSales', {});
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Période invalide' });

    managerService.getManagerSales.mockRejectedValueOnce(new Error('SQL secret'));
    res = await call(managerController, 'getSales', {});
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).not.toContain('SQL');
  });
});
