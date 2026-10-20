jest.mock('../../../src/repositories/categorieRepository');
const categorieRepository = require('../../../src/repositories/categorieRepository');
const categorieService = require('../../../src/services/categorieService');

describe('categorieService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createCategory', () => {
    it('crée la catégorie quand le nom et le code sont libres', async () => {
      categorieRepository.existsWithCodeOrName.mockResolvedValue(false);
      categorieRepository.create.mockResolvedValue({ id: 'k1' });
      await expect(
        categorieService.createCategory({ name: 'Épicerie', code: '3', description: 'd' }, 'c1')
      ).resolves.toEqual({ id: 'k1' });
      expect(categorieRepository.existsWithCodeOrName).toHaveBeenCalledWith('3', 'Épicerie', 'c1');
      expect(categorieRepository.create).toHaveBeenCalledWith({
        name: 'Épicerie',
        code: '3',
        description: 'd',
        companyId: 'c1',
      });
    });

    it('refuse un doublon (409) et des données invalides (400)', async () => {
      categorieRepository.existsWithCodeOrName.mockResolvedValue(true);
      await expect(
        categorieService.createCategory({ name: 'A', code: 1 }, 'c1')
      ).rejects.toMatchObject({ statusCode: 409 });

      await expect(
        categorieService.createCategory({ name: '', code: 'abc' }, 'c1')
      ).rejects.toMatchObject({ statusCode: 400, details: expect.any(Object) });
      expect(categorieRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('updateCategory', () => {
    it('refuse des données invalides', async () => {
      await expect(
        categorieService.updateCategory('k1', { code: '-2' }, 'c1')
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('renvoie 404 si la catégorie est absente', async () => {
      categorieRepository.getById.mockResolvedValue(null);
      await expect(
        categorieService.updateCategory('k1', { name: 'B' }, 'c1')
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('ne met à jour que les champs fournis', async () => {
      categorieRepository.getById.mockResolvedValue({ id: 'k1' });
      await categorieService.updateCategory('k1', { name: 'B', code: 4, description: null }, 'c1');
      expect(categorieRepository.update).toHaveBeenCalledWith('k1', {
        name: 'B',
        code: 4,
        description: null,
      });
      await categorieService.updateCategory('k1', { name: 'C' }, 'c1');
      expect(categorieRepository.update).toHaveBeenLastCalledWith('k1', { name: 'C' });
    });
  });

  it('deleteCategory supprime ou renvoie 404', async () => {
    categorieRepository.getById.mockResolvedValueOnce(null);
    await expect(categorieService.deleteCategory('k1', 'c1')).rejects.toMatchObject({
      statusCode: 404,
    });
    categorieRepository.getById.mockResolvedValueOnce({ id: 'k1' });
    await categorieService.deleteCategory('k1', 'c1');
    expect(categorieRepository.deleteById).toHaveBeenCalledWith('k1');
  });

  it('getCategoryById renvoie la catégorie ou 404', async () => {
    categorieRepository.getById.mockResolvedValueOnce({ id: 'k1' }).mockResolvedValueOnce(null);
    await expect(categorieService.getCategoryById('k1', 'c1')).resolves.toEqual({ id: 'k1' });
    await expect(categorieService.getCategoryById('k2', 'c1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('getAllCategories délègue au repository', async () => {
    categorieRepository.getAll.mockResolvedValue([{ id: 'k1' }]);
    await expect(categorieService.getAllCategories('c1')).resolves.toEqual([{ id: 'k1' }]);
    expect(categorieRepository.getAll).toHaveBeenCalledWith('c1');
  });

  it('searchCategoriesByName exige un nom', async () => {
    await expect(categorieService.searchCategoriesByName(undefined, 'c1')).rejects.toMatchObject({
      statusCode: 400,
    });
    categorieRepository.findByName.mockResolvedValue([]);
    await expect(categorieService.searchCategoriesByName('ép', 'c1')).resolves.toEqual([]);
    expect(categorieRepository.findByName).toHaveBeenCalledWith('ép', 'c1');
  });
});
