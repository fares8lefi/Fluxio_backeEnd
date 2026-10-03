const invoiceService = require('../../../src/services/invoiceService');

jest.mock('../../../src/repositories/invoiceRepository', () => ({
  getInvoiceByMovementId: jest.fn(),
  getLastReferenceNumber: jest.fn(),
  createInvoice: jest.fn(),
}));

jest.mock('../../../src/repositories/mouvmentRepository', () => ({
  getById: jest.fn(),
  findInvoiceableOutMovements: jest.fn(),
  countInvoiceableOutMovements: jest.fn(),
  attachClient: jest.fn(),
}));

jest.mock('../../../src/repositories/clientRepository', () => ({
  getClientByID: jest.fn(),
  updateClient: jest.fn(),
  addClient: jest.fn(),
}));

jest.mock('../../../src/repositories/companyRepository', () => ({
  findById: jest.fn(),
  update: jest.fn(),
}));

const invoiceRepository = require('../../../src/repositories/invoiceRepository');
const mouvmentRepository = require('../../../src/repositories/mouvmentRepository');
const clientRepository = require('../../../src/repositories/clientRepository');
const companyRepository = require('../../../src/repositories/companyRepository');

const COMPANY = {
  id: 'company-1',
  name: 'Ma Société',
  matriculeFiscale: '1234567A/P/M000',
  address: '10 rue de Tunis',
  phone: '71234567',
};

const CLIENT = {
  id: 'client-1',
  name: 'Société Cliente',
  matriculeFiscale: '9876543B/P/M000',
  address: '20 avenue de Carthage',
  codeTva: 'CM1234567',
  phone: '70123456',
};

const buildMovement = (overrides = {}) => ({
  id: 'mvt-1',
  type: 'OUT',
  status: 'CONFIRMED',
  reference: 'VTE-001',
  note: 'Vente comptoir',
  created_at: new Date('2026-10-01T10:00:00.000Z'),
  total_amount: 100,
  clientId: 'client-1',
  client: CLIENT,
  invoice: null,
  created_by: { id: 'user-1', username: 'admin' },
  items: [
    {
      id: 'item-1',
      productId: 'prod-1',
      quantity: 2,
      unit_price: 50,
      product: { id: 'prod-1', name: 'Clavier', code: 101, tva_rate: 19, unit_of_measure: 'pièce' },
    },
  ],
  ...overrides,
});

describe('invoiceService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMovementsForInvoice', () => {
    it('devrait retourner les mouvements OUT avec un aperçu des montants et les champs manquants', async () => {
      const readyMovement = buildMovement();
      const incompleteMovement = buildMovement({
        id: 'mvt-2',
        clientId: null,
        client: null,
      });

      mouvmentRepository.findInvoiceableOutMovements.mockResolvedValue([
        readyMovement,
        incompleteMovement,
      ]);
      mouvmentRepository.countInvoiceableOutMovements.mockResolvedValue(2);
      companyRepository.findById.mockResolvedValue(COMPANY);

      const result = await invoiceService.getMovementsForInvoice(1, 'company-1');

      expect(result.count).toBe(2);
      expect(result.movements).toHaveLength(2);

      expect(result.movements[0]).toMatchObject({
        id: 'mvt-1',
        can_generate: true,
        needs_form: false,
        has_invoice: false,
      });
      expect(result.movements[0].preview.total_ht).toBe(100);
      expect(result.movements[0].preview.total_ttc).toBe(120);
      expect(result.movements[0].preview.amount_in_words).toContain('dinars');

      expect(result.movements[1].can_generate).toBe(false);
      expect(result.movements[1].needs_form).toBe(true);
      expect(result.movements[1].readiness.missing_fields).toContainEqual(
        expect.objectContaining({ scope: 'client', field: 'clientId' })
      );

      expect(result.summary).toMatchObject({ total: 2, ready: 1, missing_info: 1 });
      expect(result.company_missing_fields).toEqual([]);
    });

    it('devrait marquer les mouvements déjà facturés', async () => {
      mouvmentRepository.findInvoiceableOutMovements.mockResolvedValue([
        buildMovement({
          invoice: { id: 'inv-1', reference: 'FAC-2026-0001', status: 'PENDING', date: new Date() },
        }),
      ]);
      mouvmentRepository.countInvoiceableOutMovements.mockResolvedValue(1);
      companyRepository.findById.mockResolvedValue(COMPANY);

      const result = await invoiceService.getMovementsForInvoice(1, 'company-1');

      expect(result.movements[0].has_invoice).toBe(true);
      expect(result.movements[0].can_generate).toBe(false);
      expect(result.summary.already_invoiced).toBe(1);
    });

    it('devrait exposer les informations manquantes de l’entreprise', async () => {
      mouvmentRepository.findInvoiceableOutMovements.mockResolvedValue([]);
      mouvmentRepository.countInvoiceableOutMovements.mockResolvedValue(0);
      companyRepository.findById.mockResolvedValue({ id: 'company-1', name: 'Ma Société' });

      const result = await invoiceService.getMovementsForInvoice(1, 'company-1');

      expect(result.company_missing_fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'matriculeFiscale', required: true }),
          expect.objectContaining({ field: 'address', required: false }),
        ])
      );
    });
  });

  describe('generateInvoiceFromMovement', () => {
    beforeEach(() => {
      invoiceRepository.getInvoiceByMovementId.mockResolvedValue(null);
      invoiceRepository.getLastReferenceNumber.mockResolvedValue(3);
      invoiceRepository.createInvoice.mockImplementation(async (data) => data);
      companyRepository.findById.mockResolvedValue(COMPANY);
    });

    it('devrait générer une facture avec un client complet', async () => {
      mouvmentRepository.getById.mockResolvedValue(buildMovement());
      clientRepository.getClientByID.mockResolvedValue(CLIENT);

      const invoice = await invoiceService.generateInvoiceFromMovement('mvt-1', 'company-1');

      expect(invoice.reference).toMatch(/^FAC-\d{4}-0004$/);
      expect(invoice.clientId).toBe('client-1');
      expect(invoice.total_ht).toBe(100);
      expect(invoice.total_ttc).toBe(120);
      expect(invoice.notes).toBe('Vente comptoir');
      expect(mouvmentRepository.attachClient).not.toHaveBeenCalled();
    });

    it('devrait refuser un mouvement qui n’est pas une sortie', async () => {
      mouvmentRepository.getById.mockResolvedValue(buildMovement({ type: 'IN' }));

      await expect(
        invoiceService.generateInvoiceFromMovement('mvt-1', 'company-1')
      ).rejects.toThrow('Seules les sorties (ventes) peuvent générer une facture');
    });

    it('devrait refuser un mouvement annulé', async () => {
      mouvmentRepository.getById.mockResolvedValue(buildMovement({ status: 'CANCELLED' }));

      await expect(
        invoiceService.generateInvoiceFromMovement('mvt-1', 'company-1')
      ).rejects.toThrow('Un mouvement annulé ne peut pas être facturé');
    });

    it('devrait refuser une facture déjà existante', async () => {
      mouvmentRepository.getById.mockResolvedValue(buildMovement());
      invoiceRepository.getInvoiceByMovementId.mockResolvedValue({ reference: 'FAC-2026-0001' });

      await expect(
        invoiceService.generateInvoiceFromMovement('mvt-1', 'company-1')
      ).rejects.toThrow('Une facture existe déjà pour ce mouvement : FAC-2026-0001');
    });

    it('devrait exiger une attestation fiscale en suspension de TVA', async () => {
      mouvmentRepository.getById.mockResolvedValue(buildMovement());

      await expect(
        invoiceService.generateInvoiceFromMovement('mvt-1', 'company-1', { is_suspended: true })
      ).rejects.toMatchObject({
        statusCode: 400,
        missing_fields: [expect.objectContaining({ field: 'attestation_ref' })],
      });
    });

    it('devrait créer un client depuis le formulaire quand le mouvement n’en a pas', async () => {
      const movement = buildMovement({ clientId: null, client: null });
      mouvmentRepository.getById.mockResolvedValue(movement);
      clientRepository.addClient.mockResolvedValue({ id: 'client-new', name: 'Nouveau Client' });

      const invoice = await invoiceService.generateInvoiceFromMovement('mvt-1', 'company-1', {
        client: {
          name: 'Nouveau Client',
          phone: '70999999',
          matriculeFiscale: '5555555C/P/M000',
          address: '30 rue de Sousse',
          codeTva: 'CM7654321',
        },
      });

      expect(clientRepository.addClient).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Nouveau Client', companyId: 'company-1' })
      );
      expect(invoice.clientId).toBe('client-new');
      expect(mouvmentRepository.attachClient).toHaveBeenCalledWith('mvt-1', 'client-new');
    });

    it('devrait compléter les informations du client existant et de l’entreprise', async () => {
      mouvmentRepository.getById.mockResolvedValue(buildMovement());
      clientRepository.getClientByID.mockResolvedValue({ ...CLIENT, address: null, codeTva: null });
      clientRepository.updateClient.mockResolvedValue({ ...CLIENT, address: '20 rue du Client' });
      companyRepository.findById.mockResolvedValue({ ...COMPANY, address: null });

      const invoice = await invoiceService.generateInvoiceFromMovement('mvt-1', 'company-1', {
        client: { address: '20 rue du Client', codeTva: 'CM1234567' },
        company: { address: '10 rue de Tunis' },
      });

      expect(clientRepository.updateClient).toHaveBeenCalledWith('client-1', {
        address: '20 rue du Client',
        codeTva: 'CM1234567',
      });
      expect(companyRepository.update).toHaveBeenCalledWith('company-1', {
        address: '10 rue de Tunis',
      });
      expect(invoice.clientId).toBe('client-1');
    });

    it('devrait renvoyer les champs manquants si le client reste incomplet', async () => {
      mouvmentRepository.getById.mockResolvedValue(buildMovement({ clientId: null, client: null }));

      await expect(
        invoiceService.generateInvoiceFromMovement('mvt-1', 'company-1')
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Informations manquantes pour générer la facture',
        missing_fields: expect.arrayContaining([
          expect.objectContaining({ scope: 'client', field: 'clientId', required: true }),
        ]),
      });
      expect(invoiceRepository.createInvoice).not.toHaveBeenCalled();
    });

    it('devrait générer la facture malgré les champs recommandés manquants si autorisé', async () => {
      const movement = buildMovement({ client: { ...CLIENT, address: null } });
      mouvmentRepository.getById.mockResolvedValue(movement);
      clientRepository.getClientByID.mockResolvedValue(movement.client);

      const invoice = await invoiceService.generateInvoiceFromMovement('mvt-1', 'company-1', {
        allow_incomplete: true,
      });

      expect(invoice.reference).toMatch(/^FAC-/);
      expect(invoice.clientId).toBe('client-1');
    });

    it('devrait rattacher un client sélectionné depuis le formulaire', async () => {
      const movement = buildMovement({ clientId: null, client: null });
      const selectedClient = { ...CLIENT, id: 'client-2' };
      mouvmentRepository.getById.mockResolvedValue(movement);
      clientRepository.getClientByID.mockResolvedValue(selectedClient);

      const invoice = await invoiceService.generateInvoiceFromMovement('mvt-1', 'company-1', {
        clientId: 'client-2',
      });

      expect(invoice.clientId).toBe('client-2');
      expect(mouvmentRepository.attachClient).toHaveBeenCalledWith('mvt-1', 'client-2');
    });

    it('devrait lever une erreur si le client sélectionné appartient à une autre société', async () => {
      mouvmentRepository.getById.mockResolvedValue(buildMovement({ clientId: null, client: null }));
      clientRepository.getClientByID.mockResolvedValue(null);

      await expect(
        invoiceService.generateInvoiceFromMovement('mvt-1', 'company-1', { clientId: 'client-x' })
      ).rejects.toThrow('Client introuvable');
    });
  });
});