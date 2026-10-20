jest.mock('../../../src/repositories/companyRepository');
const companyRepository = require('../../../src/repositories/companyRepository');
const companyService = require('../../../src/services/companyService');

describe('companyService.getMyCompany', () => {
  beforeEach(() => jest.clearAllMocks());

  it("renvoie l'entreprise de l'utilisateur", async () => {
    companyRepository.findById.mockResolvedValue({ id: 'c1', name: 'Atlas' });
    await expect(companyService.getMyCompany('c1')).resolves.toEqual({ id: 'c1', name: 'Atlas' });
    expect(companyRepository.findById).toHaveBeenCalledWith('c1');
  });

  it('échoue sans companyId ou si elle est introuvable', async () => {
    await expect(companyService.getMyCompany()).rejects.toThrow('companyId manquant');
    companyRepository.findById.mockResolvedValue(null);
    await expect(companyService.getMyCompany('c1')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('companyService.updateMyCompany', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    companyRepository.update.mockImplementation(async (id, data) => ({ id, ...data }));
  });

  it('normalise et enregistre un matricule fiscal valide', async () => {
    const result = await companyService.updateMyCompany('c1', {
      name: '  Atlas SARL ',
      matriculeFiscale: '1234567a/a/m/000',
      address: ' 12 rue de Marseille, Tunis ',
      phone: '71 123 456',
    });
    expect(companyRepository.update).toHaveBeenCalledWith('c1', {
      name: 'Atlas SARL',
      matriculeFiscale: '1234567A/A/M/000',
      address: '12 rue de Marseille, Tunis',
      phone: '71 123 456',
    });
    expect(result.matriculeFiscale).toBe('1234567A/A/M/000');
  });

  it('accepte un matricule saisi sans barres obliques', async () => {
    await companyService.updateMyCompany('c1', { matriculeFiscale: '1234567AAM000' });
    expect(companyRepository.update).toHaveBeenCalledWith('c1', {
      matriculeFiscale: '1234567AAM000',
    });
  });

  it('refuse un matricule fiscal mal formé avec une erreur par champ', async () => {
    await expect(
      companyService.updateMyCompany('c1', { matriculeFiscale: 'mf25126', name: '' })
    ).rejects.toMatchObject({
      statusCode: 400,
      details: {
        matriculeFiscale: 'Format attendu : 1234567A/A/M/000',
        name: 'La raison sociale est obligatoire',
      },
    });
    expect(companyRepository.update).not.toHaveBeenCalled();
  });

  it("vide l'adresse quand elle est effacée", async () => {
    await companyService.updateMyCompany('c1', { address: '   ' });
    expect(companyRepository.update).toHaveBeenCalledWith('c1', { address: null });
  });
});
