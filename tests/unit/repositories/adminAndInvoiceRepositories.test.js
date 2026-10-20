jest.mock('../../../config/db', () => require('../helpers/prismaMock')());
const prisma = require('../../../config/db');
const adminRepository = require('../../../src/repositories/adminRepository');
const invoiceRepository = require('../../../src/repositories/invoiceRepository');

beforeEach(() => jest.clearAllMocks());

describe('adminRepository', () => {
  it('getPlatformStats calcule les comptes suspendus', async () => {
    prisma.$transaction.mockResolvedValue([10, 7, 40, 31, 2, 5]);
    await expect(adminRepository.getPlatformStats()).resolves.toEqual({
      totalCompanies: 10,
      activeCompanies: 7,
      suspendedCompanies: 3,
      totalUsers: 40,
      activeUsers: 31,
      suspendedUsers: 9,
      newCompaniesThisMonth: 2,
      newUsersThisMonth: 5,
    });
    expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(6);
    expect(prisma.company.count).toHaveBeenCalledWith({ where: { is_active: true } });
  });

  it('findAllCompanies pagine et filtre par nom', async () => {
    prisma.$transaction.mockResolvedValue([[{ id: 'c1' }], 45]);
    await expect(
      adminRepository.findAllCompanies({ page: 3, limit: 20, search: 'atl' })
    ).resolves.toEqual({ companies: [{ id: 'c1' }], total: 45, page: 3, limit: 20, totalPages: 3 });
    expect(prisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: { contains: 'atl' } }, skip: 40, take: 20 })
    );
    expect(prisma.company.count).toHaveBeenCalledWith({ where: { name: { contains: 'atl' } } });
  });

  it('findAllCompanies utilise les valeurs par défaut sans recherche', async () => {
    prisma.$transaction.mockResolvedValue([[], 0]);
    const res = await adminRepository.findAllCompanies({});
    expect(res).toMatchObject({ page: 1, limit: 20, totalPages: 0 });
    expect(prisma.company.findMany.mock.calls[0][0]).toMatchObject({ where: {}, skip: 0 });
  });

  it.each([
    ['findCompanyById', ['c1'], 'company', 'findUnique', { where: { id: 'c1' } }],
    [
      'updateCompanyGeneralInfo',
      ['c1', { name: 'A' }],
      'company',
      'update',
      { where: { id: 'c1' }, data: { name: 'A' } },
    ],
    [
      'updateCompanyStatus',
      ['c1', false],
      'company',
      'update',
      { where: { id: 'c1' }, data: { is_active: false } },
    ],
    [
      'updateUserActiveStatus',
      ['u1', true],
      'user',
      'update',
      { where: { id: 'u1' }, data: { is_active: true } },
    ],
  ])('%s', async (fn, args, model, method, expected) => {
    prisma[model][method].mockResolvedValue('ok');
    await expect(adminRepository[fn](...args)).resolves.toBe('ok');
    expect(prisma[model][method]).toHaveBeenCalledWith(expect.objectContaining(expected));
  });
});

describe('invoiceRepository', () => {
  it('createInvoice utilise la transaction fournie', async () => {
    const tx = { invoice: { create: jest.fn().mockResolvedValue('inv') } };
    await expect(invoiceRepository.createInvoice({ reference: 'F' }, tx)).resolves.toBe('inv');
    expect(tx.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { reference: 'F' } })
    );
    await invoiceRepository.createInvoice({ reference: 'G' });
    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { reference: 'G' } })
    );
  });

  it.each([
    ['getInvoiceById', ['i1', 'c1'], 'findFirst', { where: { id: 'i1', companyId: 'c1' } }],
    [
      'findCreditNoteFor',
      ['i1', 'c1'],
      'findFirst',
      { where: { original_invoice_id: 'i1', companyId: 'c1', invoice_type: 'CREDIT_NOTE' } },
    ],
    [
      'getInvoiceByMovementId',
      ['m1', 'c1'],
      'findFirst',
      { where: { movementId: 'm1', companyId: 'c1' } },
    ],
    [
      'updateStatus',
      ['i1', 'PAID', 'c1'],
      'update',
      { where: { id: 'i1', companyId: 'c1' }, data: { status: 'PAID' } },
    ],
  ])('%s', async (fn, args, method, expected) => {
    prisma.invoice[method].mockResolvedValue('ok');
    await expect(invoiceRepository[fn](...args)).resolves.toBe('ok');
    expect(prisma.invoice[method]).toHaveBeenCalledWith(expect.objectContaining(expected));
  });

  it('findCreditNotesFor ne lance pas de requête pour une liste vide', async () => {
    await expect(invoiceRepository.findCreditNotesFor([], 'c1')).resolves.toEqual([]);
    expect(prisma.invoice.findMany).not.toHaveBeenCalled();
    await invoiceRepository.findCreditNotesFor(['i1'], 'c1');
    expect(prisma.invoice.findMany.mock.calls[0][0].where).toEqual({
      companyId: 'c1',
      invoice_type: 'CREDIT_NOTE',
      original_invoice_id: { in: ['i1'] },
    });
  });

  it('findPaginated et countAll appliquent les mêmes filtres', async () => {
    const filters = {
      status: 'PAID',
      invoice_type: 'SALE',
      clientId: 'k1',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    };
    const where = {
      companyId: 'c1',
      status: 'PAID',
      invoice_type: 'SALE',
      clientId: 'k1',
      date: { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') },
    };
    await invoiceRepository.findPaginated(3, 10, 'c1', filters);
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 20, take: 10 })
    );
    await invoiceRepository.countAll('c1', filters);
    expect(prisma.invoice.count).toHaveBeenCalledWith({ where });

    await invoiceRepository.findPaginated(1, 10, 'c1', { endDate: '2026-01-31' });
    expect(prisma.invoice.findMany.mock.calls[1][0].where).toEqual({
      companyId: 'c1',
      date: { lte: new Date('2026-01-31') },
    });
    await invoiceRepository.countAll('c1', { startDate: '2026-01-01' });
    expect(prisma.invoice.count.mock.calls[1][0].where).toEqual({
      companyId: 'c1',
      date: { gte: new Date('2026-01-01') },
    });
    await invoiceRepository.findPaginated(1, 10, 'c1');
    await invoiceRepository.countAll('c1');
    expect(prisma.invoice.count.mock.calls[2][0].where).toEqual({ companyId: 'c1' });
  });

  it('getLastReferenceNumber lit le dernier numéro du préfixe', async () => {
    prisma.invoice.findFirst
      .mockResolvedValueOnce({ reference: 'AVO-2026-0007' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ reference: 'AVO-2026-x' });
    await expect(invoiceRepository.getLastReferenceNumber('c1', 2026, 'AVO')).resolves.toBe(7);
    expect(prisma.invoice.findFirst.mock.calls[0][0].where).toEqual({
      companyId: 'c1',
      reference: { startsWith: 'AVO-2026-' },
    });
    await expect(invoiceRepository.getLastReferenceNumber('c1', 2026, 'AVO')).resolves.toBe(0);
    await expect(invoiceRepository.getLastReferenceNumber('c1', 2026, 'AVO')).resolves.toBe(0);
  });
});
