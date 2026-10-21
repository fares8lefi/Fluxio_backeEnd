const userService = require('../../../src/services/userService');
const prisma = require('../../../config/db');

jest.mock('../../../config/db', () => ({
  user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  company: { create: jest.fn(), findUnique: jest.fn() },
}));
jest.mock('../../../src/services/SendEmail', () => ({
  sendEmailVerificationCode: jest.fn().mockResolvedValue(),
  sendAdminVerificationCode: jest.fn().mockResolvedValue(),
  sendEmailResetCode: jest.fn().mockResolvedValue(),
}));
const {
  sendEmailVerificationCode,
  sendAdminVerificationCode,
} = require('../../../src/services/SendEmail');

const future = () => new Date(Date.now() + 5 * 60 * 1000);
const pendingUser = (extra = {}) => ({
  id: 'u1',
  email: 'a@b.tn',
  username: 'demo',
  code: 482913,
  code_expires_at: future(),
  code_attempts: 0,
  ...extra,
});

describe('Codes OTP', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.update.mockResolvedValue({});
  });

  it('génère un code à 6 chiffres et remet le compteur à zéro', async () => {
    prisma.user.findUnique.mockResolvedValue(pendingUser({ code_attempts: 4 }));
    await userService.resendCode('a@b.tn');
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(String(data.code)).toMatch(/^\d{6}$/);
    expect(data.code_attempts).toBe(0);
    expect(sendEmailVerificationCode).toHaveBeenCalledWith('a@b.tn', 'demo', data.code);
    expect(sendAdminVerificationCode).not.toHaveBeenCalled();
  });

  it('renvoie le gabarit administrateur à un compte admin', async () => {
    prisma.user.findUnique.mockResolvedValue(pendingUser({ role: 'admin' }));
    await userService.resendCode('a@b.tn');
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(sendAdminVerificationCode).toHaveBeenCalledWith('a@b.tn', 'demo', data.code);
    expect(sendEmailVerificationCode).not.toHaveBeenCalled();
  });

  it('active le compte avec le bon code', async () => {
    prisma.user.findUnique.mockResolvedValue(pendingUser());
    await userService.verifyAccounts('a@b.tn', '482913');
    expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({
      is_active: true,
      email_verified: true,
      code: null,
      code_attempts: 0,
    });
  });

  it('compte chaque échec et indique les essais restants', async () => {
    prisma.user.findUnique.mockResolvedValue(pendingUser({ code_attempts: 1 }));
    await expect(userService.verifyAccounts('a@b.tn', '000000')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Code invalide — 3 essai(s) restant(s)',
    });
    expect(prisma.user.update.mock.calls[0][0].data).toEqual({ code_attempts: 2 });
  });

  it('invalide le code au 5e échec', async () => {
    prisma.user.findUnique.mockResolvedValue(pendingUser({ code_attempts: 4 }));
    await expect(userService.verifyAccounts('a@b.tn', '000000')).rejects.toMatchObject({
      statusCode: 429,
    });
    expect(prisma.user.update.mock.calls[0][0].data).toEqual({
      code_attempts: 5,
      code: null,
      code_expires_at: null,
    });
  });

  it('refuse même le bon code une fois les essais épuisés', async () => {
    prisma.user.findUnique.mockResolvedValue(pendingUser({ code_attempts: 5 }));
    await expect(userService.verifyAccounts('a@b.tn', '482913')).rejects.toMatchObject({
      statusCode: 429,
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuse un code expiré', async () => {
    prisma.user.findUnique.mockResolvedValue(
      pendingUser({ code_expires_at: new Date(Date.now() - 1000) })
    );
    await expect(userService.verifyAccounts('a@b.tn', '482913')).rejects.toThrow(/expiré/);
  });

  describe('compte déjà vérifié (suspendu)', () => {
    const suspended = () =>
      pendingUser({ is_active: false, email_verified: true, code: null, code_expires_at: null });

    it('refuse de renvoyer un code', async () => {
      prisma.user.findUnique.mockResolvedValue(suspended());
      await expect(userService.resendCode('a@b.tn')).rejects.toMatchObject({ statusCode: 409 });
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(sendEmailVerificationCode).not.toHaveBeenCalled();
    });

    it('refuse de réactiver le compte, même avec un code valide', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...suspended(),
        code: 482913,
        code_expires_at: future(),
      });
      await expect(userService.verifyAccounts('a@b.tn', '482913')).rejects.toMatchObject({
        statusCode: 409,
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
