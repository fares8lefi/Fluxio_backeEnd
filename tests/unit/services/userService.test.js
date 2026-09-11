const userService = require('../../../src/services/userService');
const prisma = require('../../../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

jest.mock('../../../config/db', () => ({
  user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  company: { create: jest.fn(), findUnique: jest.fn() },
}));
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('UserService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loginUser', () => {
    it("devrait retourner une erreur si l'utilisateur n'existe pas", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        userService.loginUser({ email: 'test@test.com', password: 'password' })
      ).rejects.toThrow('email not found');
    });

    it('devrait retourner une erreur si le mot de passe est faux', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@test.com',
        password: 'hashed',
      });
      bcrypt.compare.mockResolvedValue(false);
      await expect(
        userService.loginUser({ email: 'test@test.com', password: 'wrong' })
      ).rejects.toThrow('password invalid');
    });

    it('devrait retourner le nom de la company avec les tokens', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@test.com',
        password: 'hashed',
        role: 'user',
        is_active: true,
        companyId: 'company-1',
      });
      prisma.company.findUnique.mockResolvedValue({ id: 'company-1', name: 'Fluxio' });
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('fake-token');

      const result = await userService.loginUser({ email: 'test@test.com', password: 'password' });
      expect(result).toHaveProperty('token', 'fake-token');
      expect(result).toHaveProperty('refreshToken', 'fake-token');
      expect(result.user).toHaveProperty('companyName', 'Fluxio');
      expect(prisma.company.findUnique).toHaveBeenCalledWith({ where: { id: 'company-1' } });
    });
  });
});
