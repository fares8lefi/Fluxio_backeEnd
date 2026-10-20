const prisma = require('../../../config/db');
const mouvmentService = require('../../../src/services/mouvmentService');

jest.mock('../../../config/db', () => ({
  $transaction: jest.fn((fn) => fn({ tx: true })),
}));
jest.mock('../../../src/repositories/mouvmentRepository', () => ({
  getById: jest.fn(),
  create: jest.fn(),
  updateStatus: jest.fn(),
  findPaginated: jest.fn(),
  countFiltered: jest.fn(),
}));
jest.mock('../../../src/repositories/productRepository', () => ({
  getProductById: jest.fn(),
  updateProduct: jest.fn(),
}));
jest.mock('../../../src/repositories/clientRepository', () => ({ getClientByID: jest.fn() }));
jest.mock('../../../src/repositories/supplierRepository', () => ({ findById: jest.fn() }));
const mouvmentRepository = require('../../../src/repositories/mouvmentRepository');
const productRepository = require('../../../src/repositories/productRepository');
const clientRepository = require('../../../src/repositories/clientRepository');
const supplierRepository = require('../../../src/repositories/supplierRepository');

const tx = { tx: true };
const user = { id: 'u1', companyId: 'c1' };
const products = {
  p1: {
    id: 'p1',
    name: 'Huile',
    stock_quantity: 10,
    selling_price: 5,
    purchase_price: 3,
    tva_rate: 19,
  },
  p2: {
    id: 'p2',
    name: 'Sucre',
    stock_quantity: 2,
    selling_price: 2,
    purchase_price: 1,
    tva_rate: 7,
  },
};

describe('mouvmentService — stock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    productRepository.getProductById.mockImplementation(async (id) =>
      products[id] ? { ...products[id] } : null
    );
    mouvmentRepository.create.mockImplementation(async (data) => ({ id: 'm1', ...data }));
    mouvmentRepository.updateStatus.mockImplementation(async (id, status) => ({ id, status }));
    clientRepository.getClientByID.mockImplementation(async (id, companyId) =>
      companyId === 'c1' ? { id } : null
    );
    supplierRepository.findById.mockImplementation(async (id, companyId) =>
      companyId === 'c1' ? { id } : null
    );
  });

  describe('createMouvment', () => {
    it('exige un utilisateur authentifié', async () => {
      await expect(mouvmentService.createMouvment({}, null)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('entrée : prix d’achat par défaut, instantané TVA, stock augmenté', async () => {
      const data = {
        type: 'IN',
        items: [{ productId: 'p1', quantity: 4 }],
        supplierId: 's1',
        supplier_invoice_ref: '  FA-12 ',
        supplier_invoice_date: '2026-10-01',
      };
      const res = await mouvmentService.createMouvment(data, user);

      expect(data.items[0]).toMatchObject({ unit_price: 3, tva_rate: 19, purchase_price: 3 });
      expect(productRepository.updateProduct).toHaveBeenCalledWith(
        { stock_quantity: 14 },
        'p1',
        'c1',
        tx
      );
      expect(mouvmentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'IN',
          supplierId: 's1',
          clientId: null,
          reference: null,
          status: 'CONFIRMED',
          createdById: 'u1',
          companyId: 'c1',
          supplier_invoice_ref: 'FA-12',
          supplier_invoice_date: new Date('2026-10-01'),
        }),
        tx
      );
      expect(res.id).toBe('m1');
    });

    it('sortie : prix de vente par défaut et stock diminué, sans facture fournisseur', async () => {
      const data = { type: 'OUT', items: [{ productId: 'p1', quantity: 3 }], clientId: 'cl1' };
      await mouvmentService.createMouvment(data, user);
      expect(data.items[0].unit_price).toBe(5);
      expect(productRepository.updateProduct).toHaveBeenCalledWith(
        { stock_quantity: 7 },
        'p1',
        'c1',
        tx
      );
      const created = mouvmentRepository.create.mock.calls[0][0];
      expect(created).not.toHaveProperty('supplier_invoice_ref');
      expect(created.clientId).toBe('cl1');
      expect(clientRepository.getClientByID).toHaveBeenCalledWith('cl1', 'c1');
    });

    it("refuse un client ou un fournisseur d'une autre entreprise", async () => {
      clientRepository.getClientByID.mockResolvedValueOnce(null);
      await expect(
        mouvmentService.createMouvment(
          { type: 'OUT', items: [{ productId: 'p1', quantity: 1 }], clientId: 'autre' },
          user
        )
      ).rejects.toMatchObject({ statusCode: 404, message: 'Client introuvable' });

      supplierRepository.findById.mockResolvedValueOnce(null);
      await expect(
        mouvmentService.createMouvment(
          { type: 'IN', items: [{ productId: 'p1', quantity: 1 }], supplierId: 'autre' },
          user
        )
      ).rejects.toMatchObject({ statusCode: 404, message: 'Fournisseur introuvable' });

      expect(mouvmentRepository.create).not.toHaveBeenCalled();
      expect(productRepository.updateProduct).not.toHaveBeenCalled();
    });

    it('garde le prix fourni et, avec keepTvaRate, le taux de la ligne', async () => {
      const data = {
        type: 'OUT',
        items: [{ productId: 'p1', quantity: 1, unit_price: 9, tva_rate: 7 }],
      };
      await mouvmentService.createMouvment(data, user, { keepTvaRate: true });
      expect(data.items[0]).toMatchObject({ unit_price: 9, tva_rate: 7 });

      const sansOption = { type: 'OUT', items: [{ productId: 'p1', quantity: 1, tva_rate: 7 }] };
      await mouvmentService.createMouvment(sansOption, user);
      expect(sansOption.items[0].tva_rate).toBe(19);
    });

    it('refuse une sortie en stock insuffisant sans rien modifier', async () => {
      await expect(
        mouvmentService.createMouvment(
          { type: 'RETURN_SUPPLIER', items: [{ productId: 'p2', quantity: 5 }] },
          user
        )
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Sucre') });
      expect(productRepository.updateProduct).not.toHaveBeenCalled();
      expect(mouvmentRepository.create).not.toHaveBeenCalled();
    });

    it('renvoie 404 pour un produit inconnu dans une sortie', async () => {
      await expect(
        mouvmentService.createMouvment(
          { type: 'OUT', items: [{ productId: 'zz', quantity: 1, unit_price: 1 }] },
          user
        )
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('renvoie 404 pour un produit inconnu dans une entrée', async () => {
      await expect(
        mouvmentService.createMouvment(
          { type: 'RETURN_CLIENT', items: [{ productId: 'zz', quantity: 1, unit_price: 1 }] },
          user
        )
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('refuse un mouvement invalide', async () => {
      await expect(
        mouvmentService.createMouvment({ type: 'GIFT', items: [] }, user)
      ).rejects.toMatchObject({ statusCode: 400, details: expect.any(Object) });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('cancelMouvment', () => {
    it('renvoie 404 ou 400 si le mouvement est absent ou déjà annulé', async () => {
      mouvmentRepository.getById.mockResolvedValueOnce(null);
      await expect(mouvmentService.cancelMouvment('m1', 'c1')).rejects.toMatchObject({
        statusCode: 404,
      });
      mouvmentRepository.getById.mockResolvedValueOnce({ status: 'CANCELLED', items: [] });
      await expect(mouvmentService.cancelMouvment('m1', 'c1')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it.each([
      ['IN', 6],
      ['RETURN_CLIENT', 6],
      ['OUT', 14],
      ['RETURN_SUPPLIER', 14],
      ['ADJUSTMENT', 6],
    ])('annule un mouvement %s en inversant le stock', async (type, expected) => {
      mouvmentRepository.getById.mockResolvedValue({
        type,
        status: 'CONFIRMED',
        items: [{ productId: 'p1', quantity: 4 }],
      });
      const res = await mouvmentService.cancelMouvment('m1', 'c1');
      expect(mouvmentRepository.getById).toHaveBeenCalledWith('m1', 'c1', tx);
      expect(productRepository.updateProduct).toHaveBeenCalledWith(
        { stock_quantity: expected },
        'p1',
        'c1',
        tx
      );
      expect(res).toEqual({ id: 'm1', status: 'CANCELLED' });
    });

    it("refuse d'annuler un ajustement qui rendrait le stock négatif", async () => {
      mouvmentRepository.getById.mockResolvedValue({
        type: 'ADJUSTMENT',
        status: 'CONFIRMED',
        items: [{ productId: 'p2', quantity: 5 }],
      });
      await expect(mouvmentService.cancelMouvment('m1', 'c1')).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(mouvmentRepository.updateStatus).not.toHaveBeenCalled();
    });

    it("échoue si le produit d'une ligne n'existe plus", async () => {
      mouvmentRepository.getById.mockResolvedValue({
        type: 'OUT',
        status: 'CONFIRMED',
        items: [{ productId: 'zz', quantity: 1 }],
      });
      await expect(mouvmentService.cancelMouvment('m1', 'c1')).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('getMouvmentById', () => {
    it('renvoie le mouvement ou 404', async () => {
      mouvmentRepository.getById.mockResolvedValueOnce({ id: 'm1' }).mockResolvedValueOnce(null);
      await expect(mouvmentService.getMouvmentById('m1', 'c1')).resolves.toEqual({ id: 'm1' });
      await expect(mouvmentService.getMouvmentById('m2', 'c1')).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('getAllMouvments', () => {
    it('borne la taille de page à 100', async () => {
      mouvmentRepository.findPaginated.mockResolvedValue([]);
      mouvmentRepository.countFiltered.mockResolvedValue(0);
      await mouvmentService.getAllMouvments('2', 'c1', { type: 'IN' }, '500');
      expect(mouvmentRepository.findPaginated).toHaveBeenCalledWith(2, 100, 'c1', { type: 'IN' });
      await mouvmentService.getAllMouvments(undefined, 'c1', undefined, '5');
      expect(mouvmentRepository.findPaginated).toHaveBeenLastCalledWith(1, 5, 'c1', {});
    });
  });
});
