jest.mock('../../../src/repositories/supplierRepository');
const supplierRepository = require('../../../src/repositories/supplierRepository');
const supplierService = require('../../../src/services/supplierService');

const validSupplier = (extra = {}) => ({
  name: 'Sotupa',
  code: 'F01',
  email: 'contact@sotupa.tn',
  phone: '71 000 000',
  address: 'Tunis',
  ...extra,
});

describe('supplierService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supplierRepository.create.mockImplementation(async (data) => ({ id: 's1', ...data }));
  });

  describe('addSupplier', () => {
    it('normalise le matricule fiscal et rattache la société', async () => {
      await supplierService.addSupplier(
        validSupplier({ matriculeFiscale: '1234567a/a/m/000' }),
        'c1'
      );
      expect(supplierRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ matriculeFiscale: '1234567A/A/M/000', companyId: 'c1' })
      );
    });

    it('enregistre un matricule vide comme null', async () => {
      await supplierService.addSupplier(validSupplier({ matriculeFiscale: '' }), 'c1');
      expect(supplierRepository.create.mock.calls[0][0].matriculeFiscale).toBeNull();
    });

    it('refuse des données invalides', async () => {
      await expect(
        supplierService.addSupplier({ name: 'x', email: 'pas-un-mail' }, 'c1')
      ).rejects.toMatchObject({ statusCode: 400, details: expect.any(Object) });
      expect(supplierRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('updateSupplier', () => {
    it('refuse des données invalides avant toute lecture', async () => {
      await expect(
        supplierService.updateSupplier('s1', { email: 'bad' }, 'c1')
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(supplierRepository.findById).not.toHaveBeenCalled();
    });

    it('renvoie 404 si le fournisseur est absent', async () => {
      supplierRepository.findById.mockResolvedValue(null);
      await expect(supplierService.updateSupplier('s1', { name: 'X' }, 'c1')).rejects.toMatchObject(
        { statusCode: 404 }
      );
    });

    it('ne met à jour que les champs fournis', async () => {
      supplierRepository.findById.mockResolvedValue({ id: 's1' });
      await supplierService.updateSupplier(
        's1',
        {
          name: 'N',
          code: 'C',
          email: 'a@b.tn',
          phone: '1',
          address: 'A',
          matriculeFiscale: '1234567aam000',
        },
        'c1'
      );
      expect(supplierRepository.update).toHaveBeenCalledWith('s1', {
        name: 'N',
        code: 'C',
        email: 'a@b.tn',
        phone: '1',
        address: 'A',
        matriculeFiscale: '1234567AAM000',
      });

      await supplierService.updateSupplier('s1', { phone: '2' }, 'c1');
      expect(supplierRepository.update).toHaveBeenLastCalledWith('s1', { phone: '2' });
    });
  });

  describe.each([
    ['deleteSupplier', 'deleteById'],
    ['deactivateSupplier', 'deactivate'],
    ['activateSupplier', 'activate'],
  ])('%s', (serviceFn, repoFn) => {
    it('renvoie 404 si le fournisseur est absent', async () => {
      supplierRepository.findById.mockResolvedValue(null);
      await expect(supplierService[serviceFn]('s1', 'c1')).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(supplierRepository[repoFn]).not.toHaveBeenCalled();
    });

    it('agit sur le fournisseur existant', async () => {
      supplierRepository.findById.mockResolvedValue({ id: 's1' });
      await supplierService[serviceFn]('s1', 'c1');
      expect(supplierRepository.findById).toHaveBeenCalledWith('s1', 'c1');
      expect(supplierRepository[repoFn]).toHaveBeenCalledWith('s1');
    });
  });

  it('getSupplierById renvoie le fournisseur ou 404', async () => {
    supplierRepository.findById.mockResolvedValueOnce({ id: 's1' }).mockResolvedValueOnce(null);
    await expect(supplierService.getSupplierById('s1', 'c1')).resolves.toEqual({ id: 's1' });
    await expect(supplierService.getSupplierById('s2', 'c1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('searchSuppliersByName exige un nom', async () => {
    await expect(supplierService.searchSuppliersByName('', 'c1')).rejects.toMatchObject({
      statusCode: 400,
    });
    supplierRepository.findByName.mockResolvedValue([{ id: 's1' }]);
    await expect(supplierService.searchSuppliersByName('sot', 'c1')).resolves.toEqual([
      { id: 's1' },
    ]);
    expect(supplierRepository.findByName).toHaveBeenCalledWith('sot', 'c1');
  });

  it('getActiveSuppliers et getAllSuppliers délèguent au repository', async () => {
    supplierRepository.findActive.mockResolvedValue(['a']);
    supplierRepository.findAll.mockResolvedValue(['a', 'b']);
    await expect(supplierService.getActiveSuppliers('c1')).resolves.toEqual(['a']);
    await expect(supplierService.getAllSuppliers('c1')).resolves.toEqual(['a', 'b']);
    expect(supplierRepository.findActive).toHaveBeenCalledWith('c1');
    expect(supplierRepository.findAll).toHaveBeenCalledWith('c1');
  });
});
