jest.mock('../../../config/db', () => require('../helpers/prismaMock')());
jest.mock('bcrypt', () => ({
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockResolvedValue('hashed'),
  compare: jest.fn(),
}));
const prisma = require('../../../config/db');
const bcrypt = require('bcrypt');
const categorieRepository = require('../../../src/repositories/categorieRepository');
const clientRepository = require('../../../src/repositories/clientRepository');
const supplierRepository = require('../../../src/repositories/supplierRepository');
const companyRepository = require('../../../src/repositories/companyRepository');
const quoteRepository = require('../../../src/repositories/quoteRepository');
const userRepository = require('../../../src/repositories/userRepository');

beforeEach(() => jest.clearAllMocks());

/**
 * [repository, fonction, arguments, modèle, méthode Prisma, requête attendue]
 * Chaque appel doit renvoyer le résultat Prisma tel quel.
 */
const cases = [
  // Catégories
  [categorieRepository, 'getAll', ['c1'], 'category', 'findMany', { where: { companyId: 'c1' } }],
  [
    categorieRepository,
    'getById',
    ['k1', 'c1'],
    'category',
    'findFirst',
    { where: { id: 'k1', companyId: 'c1' } },
  ],
  [categorieRepository, 'create', [{ name: 'A' }], 'category', 'create', { data: { name: 'A' } }],
  [
    categorieRepository,
    'update',
    ['k1', { name: 'B' }],
    'category',
    'update',
    { where: { id: 'k1' }, data: { name: 'B' } },
  ],
  [categorieRepository, 'deleteById', ['k1'], 'category', 'delete', { where: { id: 'k1' } }],
  [
    categorieRepository,
    'findByName',
    ['ép', 'c1'],
    'category',
    'findMany',
    { where: { name: { contains: 'ép' }, companyId: 'c1' } },
  ],
  // Clients
  [clientRepository, 'addClient', [{ name: 'A' }], 'client', 'create', { data: { name: 'A' } }],
  [
    clientRepository,
    'getClientByMatriculeFiscale',
    ['MF', 'c1'],
    'client',
    'findFirst',
    { where: { matriculeFiscale: 'MF', companyId: 'c1' } },
  ],
  [
    clientRepository,
    'updateClient',
    ['k1', { name: 'B' }],
    'client',
    'update',
    { where: { id: 'k1' }, data: { name: 'B' } },
  ],
  [clientRepository, 'deleteClient', ['k1'], 'client', 'delete', { where: { id: 'k1' } }],
  [
    clientRepository,
    'getClientByID',
    ['k1', 'c1'],
    'client',
    'findFirst',
    { where: { id: 'k1', companyId: 'c1' } },
  ],
  [clientRepository, 'getAllClients', ['c1'], 'client', 'findMany', { where: { companyId: 'c1' } }],
  [
    clientRepository,
    'searchClientsByName',
    ['me', 'c1'],
    'client',
    'findMany',
    { where: { companyId: 'c1', name: { contains: 'me' } } },
  ],
  // Fournisseurs
  [supplierRepository, 'create', [{ name: 'S' }], 'supplier', 'create', { data: { name: 'S' } }],
  [supplierRepository, 'findAll', ['c1'], 'supplier', 'findMany', { where: { companyId: 'c1' } }],
  [
    supplierRepository,
    'findActive',
    ['c1'],
    'supplier',
    'findMany',
    expect.objectContaining({ where: { is_active: true, companyId: 'c1' } }),
  ],
  [
    supplierRepository,
    'findById',
    ['s1', 'c1'],
    'supplier',
    'findFirst',
    { where: { id: 's1', companyId: 'c1' } },
  ],
  [
    supplierRepository,
    'findByName',
    ['so', 'c1'],
    'supplier',
    'findMany',
    { where: { name: { contains: 'so' }, companyId: 'c1' } },
  ],
  [
    supplierRepository,
    'update',
    ['s1', { name: 'X' }],
    'supplier',
    'update',
    { where: { id: 's1' }, data: { name: 'X' } },
  ],
  [supplierRepository, 'deleteById', ['s1'], 'supplier', 'delete', { where: { id: 's1' } }],
  [
    supplierRepository,
    'deactivate',
    ['s1'],
    'supplier',
    'update',
    { where: { id: 's1' }, data: { is_active: false } },
  ],
  [
    supplierRepository,
    'activate',
    ['s1'],
    'supplier',
    'update',
    { where: { id: 's1' }, data: { is_active: true } },
  ],
  // Entreprises
  [
    companyRepository,
    'create',
    [{ name: 'Atlas' }],
    'company',
    'create',
    { data: { name: 'Atlas' } },
  ],
  [companyRepository, 'findById', ['c1'], 'company', 'findUnique', { where: { id: 'c1' } }],
  [
    companyRepository,
    'update',
    ['c1', { phone: '71' }],
    'company',
    'update',
    { where: { id: 'c1' }, data: { phone: '71' } },
  ],
  // Devis
  [
    quoteRepository,
    'createQuote',
    [{ reference: 'DEV' }],
    'quote',
    'create',
    { data: { reference: 'DEV' }, include: { client: true, company: true } },
  ],
  [
    quoteRepository,
    'getById',
    ['q1', 'c1'],
    'quote',
    'findFirst',
    { where: { id: 'q1', companyId: 'c1' }, include: { client: true, company: true } },
  ],
  [
    quoteRepository,
    'updateStatus',
    ['q1', 'CONVERTED', 'c1', { invoice_id: 'i1' }],
    'quote',
    'update',
    { where: { id: 'q1', companyId: 'c1' }, data: { status: 'CONVERTED', invoice_id: 'i1' } },
  ],
  // Utilisateurs
  [
    userRepository,
    'findOneByEmail',
    ['a@b.tn'],
    'user',
    'findUnique',
    expect.objectContaining({ where: { email: 'a@b.tn' } }),
  ],
  [
    userRepository,
    'findOneByEmailWithPassword',
    ['a@b.tn'],
    'user',
    'findUnique',
    { where: { email: 'a@b.tn' } },
  ],
  [
    userRepository,
    'findById',
    ['u1'],
    'user',
    'findUnique',
    expect.objectContaining({ where: { id: 'u1' } }),
  ],
  [userRepository, 'findByIdWithPassword', ['u1'], 'user', 'findUnique', { where: { id: 'u1' } }],
  [
    userRepository,
    'update',
    ['u1', { phone: '1' }],
    'user',
    'update',
    expect.objectContaining({ where: { id: 'u1' }, data: { phone: '1' } }),
  ],
  [
    userRepository,
    'findAll',
    [],
    'user',
    'findMany',
    expect.objectContaining({ select: expect.any(Object) }),
  ],
  [userRepository, 'deleteById', ['u1'], 'user', 'delete', { where: { id: 'u1' } }],
];

describe.each(cases)('repositories', (repo, fn, args, model, method, expected) => {
  it(`${fn} → prisma.${model}.${method}`, async () => {
    prisma[model][method].mockResolvedValueOnce('résultat');
    await expect(repo[fn](...args)).resolves.toBe('résultat');
    expect(prisma[model][method]).toHaveBeenCalledWith(expected);
  });
});

describe('categorieRepository.existsWithCodeOrName', () => {
  it('cherche par code numérique ou nom dans la société', async () => {
    prisma.category.findFirst.mockResolvedValueOnce({ id: 'k1' }).mockResolvedValueOnce(null);
    await expect(categorieRepository.existsWithCodeOrName('3', 'A', 'c1')).resolves.toBe(true);
    await expect(categorieRepository.existsWithCodeOrName('3', 'A', 'c1')).resolves.toBe(false);
    expect(prisma.category.findFirst).toHaveBeenCalledWith({
      where: { companyId: 'c1', OR: [{ code: 3 }, { name: 'A' }] },
    });
  });
});

describe('quoteRepository', () => {
  it('findAll applique les filtres fournis', async () => {
    await quoteRepository.findAll('c1', { status: 'SENT', clientId: 'k1' });
    expect(prisma.quote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'c1', status: 'SENT', clientId: 'k1' } })
    );
    await quoteRepository.findAll('c1');
    expect(prisma.quote.findMany.mock.calls[1][0].where).toEqual({ companyId: 'c1' });
  });

  it('getLastReferenceNumber lit le dernier numéro de l’année', async () => {
    prisma.quote.findFirst
      .mockResolvedValueOnce({ reference: 'DEV-2026-0042' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ reference: 'DEV-2026-abc' });
    await expect(quoteRepository.getLastReferenceNumber('c1', 2026)).resolves.toBe(42);
    expect(prisma.quote.findFirst.mock.calls[0][0].where).toEqual({
      companyId: 'c1',
      reference: { startsWith: 'DEV-2026-' },
    });
    await expect(quoteRepository.getLastReferenceNumber('c1', 2026)).resolves.toBe(0);
    await expect(quoteRepository.getLastReferenceNumber('c1', 2026)).resolves.toBe(0);
  });
});

describe('userRepository', () => {
  it('create hache le mot de passe avant insertion', async () => {
    await userRepository.create({ email: 'a@b.tn', password: 'clair' });
    expect(bcrypt.hash).toHaveBeenCalledWith('clair', 'salt');
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { email: 'a@b.tn', password: 'hashed' },
    });
  });

  it('les sélections publiques n’exposent jamais le mot de passe', async () => {
    await userRepository.findOneByEmail('a@b.tn');
    await userRepository.findById('u1');
    await userRepository.update('u1', {});
    await userRepository.findAll();
    const selects = [
      prisma.user.findUnique.mock.calls[0][0].select,
      prisma.user.findUnique.mock.calls[1][0].select,
      prisma.user.update.mock.calls[0][0].select,
      prisma.user.findMany.mock.calls[0][0].select,
    ];
    selects.forEach((select) => {
      expect(select).not.toHaveProperty('password');
      expect(select).not.toHaveProperty('code');
      expect(select).not.toHaveProperty('refreshToken');
    });
  });

  it('verifPasswordUser compare au hash enregistré', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(userRepository.verifPasswordUser('u1', 'x')).resolves.toBe(false);
    expect(bcrypt.compare).not.toHaveBeenCalled();

    prisma.user.findUnique.mockResolvedValueOnce({ password: 'hash' });
    bcrypt.compare.mockResolvedValueOnce(true);
    await expect(userRepository.verifPasswordUser('u1', 'x')).resolves.toBe(true);
    expect(bcrypt.compare).toHaveBeenCalledWith('x', 'hash');
  });
});
