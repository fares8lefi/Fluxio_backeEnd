jest.mock('../../../config/db', () => require('../helpers/prismaMock')());
const prisma = require('../../../config/db');
const mouvmentRepository = require('../../../src/repositories/mouvmentRepository');

beforeEach(() => jest.clearAllMocks());

describe('mouvmentRepository', () => {
  describe('create', () => {
    it('fige le montant total et relie société, tiers, auteur et produits', async () => {
      await mouvmentRepository.create({
        type: 'IN',
        reference: 'BE-1',
        items: [
          { productId: 'p1', quantity: 2, unit_price: 1.5, tva_rate: 19, purchase_price: 1 },
          { productId: 'p2', quantity: 3 },
        ],
        supplierId: 's1',
        createdById: 'u1',
        companyId: 'c1',
      });

      const { data } = prisma.movement.create.mock.calls[0][0];
      expect(data).toMatchObject({
        type: 'IN',
        reference: 'BE-1',
        total_amount: 3,
        company: { connect: { id: 'c1' } },
        supplier: { connect: { id: 's1' } },
        client: undefined,
        created_by: { connect: { id: 'u1' } },
      });
      expect(data.items.create).toEqual([
        {
          quantity: 2,
          unit_price: 1.5,
          tva_rate: 19,
          purchase_price: 1,
          product: { connect: { id: 'p1' } },
        },
        {
          quantity: 3,
          unit_price: 0,
          tva_rate: null,
          purchase_price: null,
          product: { connect: { id: 'p2' } },
        },
      ]);
    });

    it('utilise la transaction fournie et relie le client', async () => {
      const tx = { movement: { create: jest.fn().mockResolvedValue('m') } };
      await expect(
        mouvmentRepository.create(
          {
            type: 'OUT',
            items: [{ productId: 'p1', quantity: 1, unit_price: 2 }],
            clientId: 'k1',
            createdById: 'u1',
          },
          tx
        )
      ).resolves.toBe('m');
      const { data } = tx.movement.create.mock.calls[0][0];
      expect(data.client).toEqual({ connect: { id: 'k1' } });
      expect(data.company).toBeUndefined();
      expect(prisma.movement.create).not.toHaveBeenCalled();
    });
  });

  it('findPaginated et countFiltered appliquent les mêmes filtres', async () => {
    const filters = {
      type: 'OUT',
      status: 'CONFIRMED',
      clientId: 'k1',
      supplierId: 's1',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    };
    const where = {
      companyId: 'c1',
      type: 'OUT',
      status: 'CONFIRMED',
      clientId: 'k1',
      supplierId: 's1',
      created_at: { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') },
    };
    await mouvmentRepository.findPaginated(2, 10, 'c1', filters);
    expect(prisma.movement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 10, take: 10, orderBy: { created_at: 'desc' } })
    );
    await mouvmentRepository.countFiltered('c1', filters);
    expect(prisma.movement.count).toHaveBeenCalledWith({ where });

    await mouvmentRepository.findPaginated(1, 10, 'c1', { endDate: '2026-01-31' });
    expect(prisma.movement.findMany.mock.calls[1][0].where).toEqual({
      companyId: 'c1',
      created_at: { lte: new Date('2026-01-31') },
    });
    await mouvmentRepository.countFiltered('c1', { startDate: '2026-01-01' });
    expect(prisma.movement.count.mock.calls[1][0].where).toEqual({
      companyId: 'c1',
      created_at: { gte: new Date('2026-01-01') },
    });
    await mouvmentRepository.findPaginated(1, 10, 'c1');
    await mouvmentRepository.countFiltered('c1');
    expect(prisma.movement.count.mock.calls[2][0].where).toEqual({ companyId: 'c1' });
  });

  it.each([
    ['findByClientId', ['k1', 'c1'], { clientId: 'k1', companyId: 'c1' }],
    ['findBySupplierId', ['s1', 'c1'], { supplierId: 's1', companyId: 'c1' }],
  ])('%s filtre par tiers et société', async (fn, args, where) => {
    prisma.movement.findMany.mockResolvedValue(['m']);
    await expect(mouvmentRepository[fn](...args)).resolves.toEqual(['m']);
    expect(prisma.movement.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
  });

  it('countAll compte les mouvements de la société', async () => {
    prisma.movement.count.mockResolvedValue(4);
    await expect(mouvmentRepository.countAll('c1')).resolves.toBe(4);
    expect(prisma.movement.count).toHaveBeenCalledWith({ where: { companyId: 'c1' } });
  });

  describe('mouvements facturables', () => {
    it('construit le filtre complet', async () => {
      await mouvmentRepository.findInvoiceableOutMovements(3, 5, 'c1', {
        movementId: 'm1',
        clientId: 'k1',
        onlyNotInvoiced: true,
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        search: 'med',
      });
      const query = prisma.movement.findMany.mock.calls[0][0];
      expect(query).toMatchObject({ skip: 10, take: 5 });
      expect(query.where).toEqual({
        companyId: 'c1',
        type: 'OUT',
        status: { not: 'CANCELLED' },
        id: 'm1',
        clientId: 'k1',
        invoice: null,
        created_at: { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') },
        OR: [
          { reference: { contains: 'med' } },
          { note: { contains: 'med' } },
          { client: { name: { contains: 'med' } } },
          { client: { matriculeFiscale: { contains: 'med' } } },
        ],
      });
    });

    it('compte avec le même filtre (déjà facturés, date de fin seule)', async () => {
      await mouvmentRepository.countInvoiceableOutMovements('c1', {
        onlyInvoiced: true,
        endDate: '2026-01-31',
      });
      expect(prisma.movement.count).toHaveBeenCalledWith({
        where: {
          companyId: 'c1',
          type: 'OUT',
          status: { not: 'CANCELLED' },
          invoice: { isNot: null },
          created_at: { lte: new Date('2026-01-31') },
        },
      });
      await mouvmentRepository.countInvoiceableOutMovements('c1', { startDate: '2026-01-01' });
      expect(prisma.movement.count.mock.calls[1][0].where.created_at).toEqual({
        gte: new Date('2026-01-01'),
      });
      await mouvmentRepository.findInvoiceableOutMovements(1, 5, 'c1');
      expect(prisma.movement.findMany.mock.calls[0][0].where).toEqual({
        companyId: 'c1',
        type: 'OUT',
        status: { not: 'CANCELLED' },
      });
    });
  });

  it.each([
    ['attachClient', ['m1', 'k1'], 'update', { where: { id: 'm1' }, data: { clientId: 'k1' } }],
    ['getById', ['m1', 'c1'], 'findFirst', { where: { id: 'm1', companyId: 'c1' } }],
    [
      'updateStatus',
      ['m1', 'CANCELLED'],
      'update',
      { where: { id: 'm1' }, data: { status: 'CANCELLED' } },
    ],
  ])('%s fonctionne avec ou sans transaction', async (fn, args, method, expected) => {
    await mouvmentRepository[fn](...args);
    expect(prisma.movement[method]).toHaveBeenCalledWith(expect.objectContaining(expected));

    const tx = { movement: { [method]: jest.fn().mockResolvedValue('tx') } };
    await expect(mouvmentRepository[fn](...args, tx)).resolves.toBe('tx');
    expect(tx.movement[method]).toHaveBeenCalledWith(expect.objectContaining(expected));
  });
});
