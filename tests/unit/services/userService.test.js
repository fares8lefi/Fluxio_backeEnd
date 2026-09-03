const userService = require('../../src/services/userService');
const prisma = require('../../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

jest.mock('../../config/db', () => ({
  user: { findUnique: jest.fn(), create: jest.fn() },
  company: { create: jest.fn() }
}));
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('UserService', () => {
  afterEach(() => { jest.clearAllMocks(); });

  describe('login', () => {
    it('devrait retourner une erreur si l\'utilisateur n\'existe pas', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(userService.login('test@test.com', 'password')).rejects.toThrow('Invalid credentials');
    });

    it('devrait retourner une erreur si le mot de passe est faux', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, email: 'test@test.com', password: 'hashed' });
      bcrypt.compare.mockResolvedValue(false);
      await expect(userService.login('test@test.com', 'wrong')).rejects.toThrow('Invalid credentials');
    });

    it('devrait retourner des tokens si le login est valide', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, email: 'test@test.com', password: 'hashed' });
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('fake-token');

      const result = await userService.login('test@test.com', 'password');
      expect(result).toHaveProperty('token', 'fake-token');
      expect(result).toHaveProperty('refreshToken', 'fake-token');
    });
  });
});
