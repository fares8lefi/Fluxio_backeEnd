jest.mock('../../../src/repositories/adminRepository');
jest.mock('../../../src/repositories/userRepository');
jest.mock('../../../src/services/SendEmail');
const { sendAdminVerificationCode } = require('../../../src/services/SendEmail');
const adminRepository = require('../../../src/repositories/adminRepository');
const userRepository = require('../../../src/repositories/userRepository');
const adminService = require('../../../src/services/adminService');

describe('adminService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getPlatformStats et getAllCompanies délèguent au repository', async () => {
    adminRepository.getPlatformStats.mockResolvedValue({ companies: 3 });
    adminRepository.findAllCompanies.mockResolvedValue({ data: [], total: 0 });
    await expect(adminService.getPlatformStats()).resolves.toEqual({ companies: 3 });
    await adminService.getAllCompanies({ page: 2, limit: 5, search: 'atl', extra: 1 });
    expect(adminRepository.findAllCompanies).toHaveBeenCalledWith({
      page: 2,
      limit: 5,
      search: 'atl',
    });
  });

  it('getCompanyDetails renvoie la société ou 404', async () => {
    adminRepository.findCompanyById.mockResolvedValueOnce({ id: 'c1' }).mockResolvedValueOnce(null);
    await expect(adminService.getCompanyDetails('c1')).resolves.toEqual({ id: 'c1' });
    await expect(adminService.getCompanyDetails('c2')).rejects.toMatchObject({ statusCode: 404 });
  });

  describe('updateCompanyGeneralInfo', () => {
    beforeEach(() => adminRepository.findCompanyById.mockResolvedValue({ id: 'c1' }));

    it('ne transmet que les champs autorisés', async () => {
      await adminService.updateCompanyGeneralInfo('c1', {
        name: 'Atlas',
        phone: '71',
        address: 'Tunis',
        matriculeFiscale: 'MF',
        is_active: false,
        stock: 99,
      });
      expect(adminRepository.updateCompanyGeneralInfo).toHaveBeenCalledWith('c1', {
        name: 'Atlas',
        phone: '71',
        address: 'Tunis',
        matriculeFiscale: 'MF',
      });
    });

    it('refuse une mise à jour sans champ autorisé', async () => {
      await expect(adminService.updateCompanyGeneralInfo('c1', { stock: 1 })).rejects.toMatchObject(
        { statusCode: 400 }
      );
      expect(adminRepository.updateCompanyGeneralInfo).not.toHaveBeenCalled();
    });

    it("renvoie 404 si la société n'existe pas", async () => {
      adminRepository.findCompanyById.mockResolvedValue(null);
      await expect(
        adminService.updateCompanyGeneralInfo('c9', { name: 'X' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  it('toggleCompanyStatus vérifie la société avant de changer son statut', async () => {
    adminRepository.findCompanyById.mockResolvedValueOnce(null);
    await expect(adminService.toggleCompanyStatus('c1', false)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(adminRepository.updateCompanyStatus).not.toHaveBeenCalled();

    adminRepository.findCompanyById.mockResolvedValueOnce({ id: 'c1' });
    await adminService.toggleCompanyStatus('c1', false);
    expect(adminRepository.updateCompanyStatus).toHaveBeenCalledWith('c1', false);
  });

  it('toggleUserStatus délègue au repository', async () => {
    adminRepository.updateUserActiveStatus.mockResolvedValue({ id: 'u1', is_active: true });
    await expect(adminService.toggleUserStatus('u1', true)).resolves.toEqual({
      id: 'u1',
      is_active: true,
    });
    expect(adminRepository.updateUserActiveStatus).toHaveBeenCalledWith('u1', true);
  });

  describe('createAdmin', () => {
    const payload = {
      username: ' ops ',
      email: 'Ops@Fluxio.tn',
      password: 'Sup3rSecret',
      phone: '+216 20 000 000',
      role: 'user',
      companyId: 'c1',
    };

    it('crée un admin inactif avec code OTP, envoie le code et masque le mot de passe', async () => {
      userRepository.findOneByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue({
        id: 'a1',
        username: 'ops',
        email: 'ops@fluxio.tn',
        password: 'hash',
        phone: '+216 20 000 000',
        role: 'admin',
        is_active: false,
        code: 123456,
        created_at: 'now',
      });

      const admin = await adminService.createAdmin(payload, { username: 'root' });

      expect(userRepository.findOneByEmail).toHaveBeenCalledWith('ops@fluxio.tn');
      const created = userRepository.create.mock.calls[0][0];
      expect(created).toEqual({
        username: 'ops',
        email: 'ops@fluxio.tn',
        password: 'Sup3rSecret',
        phone: '+216 20 000 000',
        code: expect.any(Number),
        code_expires_at: expect.any(Date),
        code_attempts: 0,
        role: 'admin',
        is_active: false,
      });
      expect(String(created.code)).toMatch(/^\d{6}$/);
      expect(sendAdminVerificationCode).toHaveBeenCalledWith(
        'ops@fluxio.tn',
        'ops',
        created.code,
        'root'
      );
      expect(admin).not.toHaveProperty('password');
      expect(admin).not.toHaveProperty('code');
      expect(admin).toMatchObject({ id: 'a1', role: 'admin', is_active: false });
    });

    it('refuse des données invalides (400 avec détails)', async () => {
      await expect(
        adminService.createAdmin({ username: 'ab', email: 'x', password: '123' })
      ).rejects.toMatchObject({
        statusCode: 400,
        details: {
          username: expect.any(String),
          email: expect.any(String),
          password: expect.any(String),
        },
      });
      await expect(adminService.createAdmin()).rejects.toMatchObject({ statusCode: 400 });
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('renvoie 409 si l’email est déjà utilisé', async () => {
      userRepository.findOneByEmail.mockResolvedValue({ id: 'u1' });
      await expect(adminService.createAdmin(payload)).rejects.toMatchObject({ statusCode: 409 });
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it.each([
      [['username'], 'username'],
      [['phone'], 'phone'],
    ])('traduit la contrainte unique %j en 409', async (target, field) => {
      userRepository.findOneByEmail.mockResolvedValue(null);
      userRepository.create.mockRejectedValue(
        Object.assign(new Error('dup'), { code: 'P2002', meta: { target } })
      );
      await expect(adminService.createAdmin(payload)).rejects.toMatchObject({
        statusCode: 409,
        details: { [field]: 'Déjà utilisé' },
      });
      expect(sendAdminVerificationCode).not.toHaveBeenCalled();
    });

    it('laisse remonter les autres erreurs', async () => {
      userRepository.findOneByEmail.mockResolvedValue(null);
      userRepository.create.mockRejectedValue(new Error('db'));
      await expect(adminService.createAdmin(payload)).rejects.toThrow('db');
    });
  });
});
