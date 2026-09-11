const mouvmentService = require('../../../src/services/mouvmentService');

jest.mock('../../../config/db', () => ({
  $transaction: jest.fn((fn) => fn({})),
  mouvment: { findMany: jest.fn(), create: jest.fn() },
  product: { findUnique: jest.fn(), update: jest.fn() },
}));

jest.mock('../../../src/repositories/mouvmentRepository', () => ({
  findPaginated: jest.fn(),
  countFiltered: jest.fn(),
  findByClientId: jest.fn(),
  findBySupplierId: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  updateStatus: jest.fn(),
}));

jest.mock('../../../src/repositories/productRepository', () => ({
  getProductById: jest.fn(),
  updateProduct: jest.fn(),
}));

const mouvmentRepository = require('../../../src/repositories/mouvmentRepository');

describe('MouvmentService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllMouvments', () => {
    it('devrait retourner tous les mouvements paginés d une compagnie', async () => {
      const mockMouvments = [
        { id: 1, type: 'IN' },
        { id: 2, type: 'OUT' },
      ];
      mouvmentRepository.findPaginated.mockResolvedValue(mockMouvments);
      mouvmentRepository.countFiltered.mockResolvedValue(2);

      const result = await mouvmentService.getAllMouvments(1, 'company-id', {});
      expect(result).toHaveProperty('mouvments');
      expect(result).toHaveProperty('count', 2);
      expect(result.mouvments).toEqual(mockMouvments);
    });
  });

  describe('getMouvmentsByClient', () => {
    it('devrait retourner les mouvements d un client', async () => {
      const mockMouvments = [{ id: 1, type: 'OUT', clientId: 'client-1' }];
      mouvmentRepository.findByClientId.mockResolvedValue(mockMouvments);

      const result = await mouvmentService.getMouvmentsByClient('client-1', 'company-id');
      expect(result).toHaveProperty('mouvments');
      expect(result).toHaveProperty('count', 1);
    });

    it('devrait lever une erreur si clientId est manquant', async () => {
      await expect(mouvmentService.getMouvmentsByClient(null, 'company-id')).rejects.toThrow(
        'clientId est requis'
      );
    });
  });
});
