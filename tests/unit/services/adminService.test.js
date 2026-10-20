jest.mock('../../../src/repositories/adminRepository');
const adminRepository = require('../../../src/repositories/adminRepository');
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
});
