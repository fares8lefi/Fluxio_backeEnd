jest.mock('../../../src/repositories/clientRepository');
const clientRepository = require('../../../src/repositories/clientRepository');
const clientService = require('../../../src/services/clientService');

const validClient = {
  name: 'Magasin Général',
  phone: '71 111 111',
  matriculeFiscale: '1234567A/A/M/000',
};

describe('clientService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createClient', () => {
    it('rattache le client à la société', async () => {
      clientRepository.addClient.mockResolvedValue({ id: 'cl1' });
      await expect(clientService.createClient(validClient, 'c1')).resolves.toEqual({ id: 'cl1' });
      expect(clientRepository.addClient).toHaveBeenCalledWith({ ...validClient, companyId: 'c1' });
    });

    it('ignore les champs hors schéma (companyId, relations Prisma)', async () => {
      clientRepository.addClient.mockResolvedValue({ id: 'cl1' });
      await clientService.createClient(
        {
          ...validClient,
          companyId: 'autre',
          userId: 'u9',
          invoices: { connect: [{ id: 'inv-autre' }] },
        },
        'c1'
      );
      expect(clientRepository.addClient).toHaveBeenCalledWith({ ...validClient, companyId: 'c1' });
    });

    it('refuse un client invalide', async () => {
      await expect(clientService.createClient({ name: 'X' }, 'c1')).rejects.toMatchObject({
        statusCode: 400,
        details: expect.objectContaining({ phone: expect.any(String) }),
      });
      expect(clientRepository.addClient).not.toHaveBeenCalled();
    });
  });

  describe('updateClient', () => {
    it('renvoie 404 si le client est absent', async () => {
      clientRepository.getClientByID.mockResolvedValue(null);
      await expect(clientService.updateClient('cl1', { name: 'Y' }, 'c1')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('refuse des données invalides', async () => {
      clientRepository.getClientByID.mockResolvedValue({ id: 'cl1' });
      await expect(clientService.updateClient('cl1', { name: '' }, 'c1')).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(clientRepository.updateClient).not.toHaveBeenCalled();
    });

    it('met à jour le client existant', async () => {
      clientRepository.getClientByID.mockResolvedValue({ id: 'cl1' });
      clientRepository.updateClient.mockResolvedValue({ id: 'cl1', name: 'Y' });
      await expect(clientService.updateClient('cl1', { name: 'Y' }, 'c1')).resolves.toEqual({
        id: 'cl1',
        name: 'Y',
      });
      expect(clientRepository.updateClient).toHaveBeenCalledWith('cl1', { name: 'Y' });
    });

    it("n'enregistre pas companyId ni les relations envoyés dans le corps", async () => {
      clientRepository.getClientByID.mockResolvedValue({ id: 'cl1' });
      await clientService.updateClient(
        'cl1',
        { name: 'Y', companyId: 'autre', movements: { connect: [{ id: 'm9' }] } },
        'c1'
      );
      expect(clientRepository.updateClient).toHaveBeenCalledWith('cl1', { name: 'Y' });
    });
  });

  it('deleteClient supprime ou renvoie 404', async () => {
    clientRepository.getClientByID.mockResolvedValueOnce(null);
    await expect(clientService.deleteClient('cl1', 'c1')).rejects.toMatchObject({
      statusCode: 404,
    });
    clientRepository.getClientByID.mockResolvedValueOnce({ id: 'cl1' });
    await clientService.deleteClient('cl1', 'c1');
    expect(clientRepository.deleteClient).toHaveBeenCalledWith('cl1');
  });

  it('getClientByMatriculeFiscale valide le MF et le résultat', async () => {
    await expect(clientService.getClientByMatriculeFiscale('', 'c1')).rejects.toMatchObject({
      statusCode: 400,
    });
    clientRepository.getClientByMatriculeFiscale.mockResolvedValueOnce(null);
    await expect(clientService.getClientByMatriculeFiscale('MF', 'c1')).rejects.toMatchObject({
      statusCode: 404,
    });
    clientRepository.getClientByMatriculeFiscale.mockResolvedValueOnce({ id: 'cl1' });
    await expect(clientService.getClientByMatriculeFiscale('MF', 'c1')).resolves.toEqual({
      id: 'cl1',
    });
  });

  it('getClientByID renvoie le client ou 404', async () => {
    clientRepository.getClientByID.mockResolvedValueOnce({ id: 'cl1' }).mockResolvedValueOnce(null);
    await expect(clientService.getClientByID('cl1', 'c1')).resolves.toEqual({ id: 'cl1' });
    await expect(clientService.getClientByID('cl2', 'c1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('getAllClients renvoie une liste vide plutôt que null', async () => {
    clientRepository.getAllClients.mockResolvedValueOnce(null);
    await expect(clientService.getAllClients('c1')).resolves.toEqual([]);
    clientRepository.getAllClients.mockResolvedValueOnce([{ id: 'cl1' }]);
    await expect(clientService.getAllClients('c1')).resolves.toEqual([{ id: 'cl1' }]);
  });

  it('searchClientsByName exige un nom et au moins un résultat', async () => {
    await expect(clientService.searchClientsByName('', 'c1')).rejects.toMatchObject({
      statusCode: 400,
    });
    clientRepository.searchClientsByName.mockResolvedValueOnce([]);
    await expect(clientService.searchClientsByName('mag', 'c1')).rejects.toMatchObject({
      statusCode: 404,
    });
    clientRepository.searchClientsByName.mockResolvedValueOnce([{ id: 'cl1' }]);
    await expect(clientService.searchClientsByName('mag', 'c1')).resolves.toEqual([{ id: 'cl1' }]);
  });
});
