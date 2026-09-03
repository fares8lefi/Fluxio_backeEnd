const mouvmentService = require('../../src/services/mouvmentService');
const prisma = require('../../config/db');

jest.mock('../../config/db', () => ({
  mouvment: { findMany: jest.fn(), create: jest.fn() },
  product: { findUnique: jest.fn(), update: jest.fn() }
}));

describe('MouvmentService', () => {
  afterEach(() => { jest.clearAllMocks(); });

  describe('getAllMouvment', () => {
    it('devrait retourner tous les mouvements d une compagnie', async () => {
      const mockMouvments = [{ id: 1, type: 'IN' }, { id: 2, type: 'OUT' }];
      prisma.mouvment.findMany.mockResolvedValue(mockMouvments);

      const result = await mouvmentService.getAllMouvment('company-id', {});
      expect(result).toEqual(mockMouvments);
      expect(prisma.mouvment.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ companyId: 'company-id' })
      }));
    });
  });
});
