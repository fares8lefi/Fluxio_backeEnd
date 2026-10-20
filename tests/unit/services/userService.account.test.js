jest.mock('../../../src/repositories/userRepository');
jest.mock('../../../src/repositories/companyRepository');
jest.mock('../../../src/services/SendEmail', () => ({
  sendEmailVerificationCode: jest.fn().mockResolvedValue(),
  sendEmailResetCode: jest.fn().mockResolvedValue(),
}));
jest.mock('bcrypt', () => ({
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockResolvedValue('hashed'),
  compare: jest.fn(),
}));
const jwt = require('jsonwebtoken');
const userRepository = require('../../../src/repositories/userRepository');
const companyRepository = require('../../../src/repositories/companyRepository');
const {
  sendEmailVerificationCode,
  sendEmailResetCode,
} = require('../../../src/services/SendEmail');
const userService = require('../../../src/services/userService');

const registration = (extra = {}) => ({
  username: 'demo',
  email: 'demo@atlas.tn',
  password: 'Secret123',
  phone: '+216 71 000 000',
  company_name: 'Atlas',
  matriculeFiscale: '1234567A/A/M/000',
  ...extra,
});

describe('userService — compte', () => {
  const env = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...env, net_Secret: 'test-secret', REFRESH_TOKEN_SECRET: 'refresh-secret' };
    userRepository.update.mockResolvedValue({});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    process.env = env;
  });

  describe('createUser', () => {
    it('crée la société, un utilisateur inactif (rôle admin ignoré) et envoie le code', async () => {
      userRepository.findOneByEmail.mockResolvedValue(null);
      companyRepository.create.mockResolvedValue({ id: 'c1' });

      await userService.createUser(registration({ role: 'admin' }));

      expect(companyRepository.create).toHaveBeenCalledWith({
        name: 'Atlas',
        matriculeFiscale: '1234567A/A/M/000',
      });
      const created = userRepository.create.mock.calls[0][0];
      expect(created).toMatchObject({
        email: 'demo@atlas.tn',
        is_active: false,
        role: 'user',
        companyId: 'c1',
        code_attempts: 0,
      });
      expect(String(created.code)).toMatch(/^\d{6}$/);
      expect(sendEmailVerificationCode).toHaveBeenCalledWith('demo@atlas.tn', 'demo', created.code);
    });

    it("force le rôle 'user' pour toute autre valeur", async () => {
      userRepository.findOneByEmail.mockResolvedValue(null);
      companyRepository.create.mockResolvedValue({ id: 'c1' });
      await userService.createUser(registration());
      expect(userRepository.create.mock.calls[0][0].role).toBe('user');
    });

    it('refuse un email déjà utilisé (409) ou des données invalides (400)', async () => {
      userRepository.findOneByEmail.mockResolvedValue({ id: 'u0' });
      await expect(userService.createUser(registration())).rejects.toMatchObject({
        statusCode: 409,
      });
      await expect(
        userService.createUser(registration({ password: 'court' }))
      ).rejects.toMatchObject({ statusCode: 400, details: { password: expect.any(String) } });
      expect(companyRepository.create).not.toHaveBeenCalled();
    });
  });

  it('verifyAccounts et resendCode renvoient 404 pour un email inconnu', async () => {
    userRepository.findOneByEmailWithPassword.mockResolvedValue(null);
    await expect(userService.verifyAccounts('x@y.tn', '1')).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(userService.resendCode('x@y.tn')).rejects.toMatchObject({ statusCode: 404 });
  });

  describe('forgetPassword', () => {
    it("ne révèle pas qu'un email est inconnu", async () => {
      userRepository.findOneByEmailWithPassword.mockResolvedValue(null);
      await expect(userService.forgetPassword('x@y.tn')).resolves.toBeUndefined();
      expect(sendEmailResetCode).not.toHaveBeenCalled();
    });

    it('enregistre un nouveau code et l’envoie', async () => {
      userRepository.findOneByEmailWithPassword.mockResolvedValue({ id: 'u1', username: 'demo' });
      await userService.forgetPassword('demo@atlas.tn');
      const otp = userRepository.update.mock.calls[0][1];
      expect(userRepository.update).toHaveBeenCalledWith('u1', otp);
      expect(sendEmailResetCode).toHaveBeenCalledWith('demo@atlas.tn', 'demo', otp.code);
    });
  });

  describe('forgetPasswordVerifyCode', () => {
    const withCode = { id: 'u1', code: 123456, code_expires_at: new Date(Date.now() + 6e4) };

    it('refuse un mot de passe trop court', async () => {
      await expect(
        userService.forgetPasswordVerifyCode('a@b.tn', '123456', 'court')
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(userRepository.findOneByEmailWithPassword).not.toHaveBeenCalled();
    });

    it('renvoie 404 pour un email inconnu', async () => {
      userRepository.findOneByEmailWithPassword.mockResolvedValue(null);
      await expect(
        userService.forgetPasswordVerifyCode('a@b.tn', '123456', 'NouveauMdp1')
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('enregistre le mot de passe haché et invalide le code', async () => {
      userRepository.findOneByEmailWithPassword.mockResolvedValue(withCode);
      await userService.forgetPasswordVerifyCode('a@b.tn', ' 123456 ', 'NouveauMdp1');
      expect(userRepository.update).toHaveBeenCalledWith('u1', {
        password: 'hashed',
        code: null,
        code_expires_at: null,
        code_attempts: 0,
      });
    });

    it('refuse un mauvais code sans changer le mot de passe', async () => {
      userRepository.findOneByEmailWithPassword.mockResolvedValue(withCode);
      await expect(
        userService.forgetPasswordVerifyCode('a@b.tn', '000000', 'NouveauMdp1')
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(userRepository.update).not.toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ password: expect.anything() })
      );
    });
  });

  it('loginUser refuse des identifiants mal formés', async () => {
    await expect(userService.loginUser({ email: 'pas-un-mail' })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  describe('getConnectedUser', () => {
    it('renvoie 404 sans id ou pour un utilisateur absent', async () => {
      await expect(userService.getConnectedUser()).rejects.toMatchObject({ statusCode: 404 });
      userRepository.findById.mockResolvedValue(null);
      await expect(userService.getConnectedUser('u1')).rejects.toMatchObject({ statusCode: 404 });
    });

    it("renvoie l'utilisateur", async () => {
      userRepository.findById.mockResolvedValue({ id: 'u1' });
      await expect(userService.getConnectedUser('u1')).resolves.toEqual({ id: 'u1' });
    });
  });

  describe('changePassword', () => {
    it('exige une session et le bon mot de passe actuel', async () => {
      await expect(userService.changePassword(null, 'a', 'b')).rejects.toMatchObject({
        statusCode: 401,
      });
      userRepository.verifPasswordUser.mockResolvedValue(false);
      await expect(userService.changePassword('u1', 'faux', 'NouveauMdp1')).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('valide puis enregistre le nouveau mot de passe haché', async () => {
      userRepository.verifPasswordUser.mockResolvedValue(true);
      await expect(userService.changePassword('u1', 'ancien', 'court')).rejects.toMatchObject({
        statusCode: 400,
      });
      await userService.changePassword('u1', 'ancien', 'NouveauMdp1');
      expect(userRepository.update).toHaveBeenCalledWith('u1', { password: 'hashed' });
    });
  });

  describe('updatePersonnelData', () => {
    it('valide les données, la session et le mot de passe', async () => {
      await expect(
        userService.updatePersonnelData('u1', { email: 'bad' }, 'pwd')
      ).rejects.toMatchObject({ statusCode: 400 });
      await expect(
        userService.updatePersonnelData(null, { phone: '71000000' }, 'pwd')
      ).rejects.toMatchObject({ statusCode: 401 });
      userRepository.verifPasswordUser.mockResolvedValue(false);
      await expect(
        userService.updatePersonnelData('u1', { phone: '71000000' }, 'pwd')
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('enregistre seulement les champs renseignés', async () => {
      userRepository.verifPasswordUser.mockResolvedValue(true);
      await userService.updatePersonnelData(
        'u1',
        { username: 'neo', email: 'neo@atlas.tn', phone: '71000000' },
        'pwd'
      );
      expect(userRepository.update).toHaveBeenCalledWith('u1', {
        username: 'neo',
        email: 'neo@atlas.tn',
        phone: '71000000',
      });

      userRepository.update.mockClear();
      await userService.updatePersonnelData('u1', {}, 'pwd');
      expect(userRepository.update).not.toHaveBeenCalled();
    });
  });

  it('updateUserStatus active le compte ou renvoie 404', async () => {
    userRepository.findById.mockResolvedValueOnce(null);
    await expect(userService.updateUserStatus('u1')).rejects.toMatchObject({ statusCode: 404 });
    userRepository.findById.mockResolvedValueOnce({ id: 'u1' });
    await userService.updateUserStatus('u1');
    expect(userRepository.update).toHaveBeenCalledWith('u1', { is_active: true });
  });

  it('getAllUsers délègue au repository', async () => {
    userRepository.findAll.mockResolvedValue([{ id: 'u1' }]);
    await expect(userService.getAllUsers()).resolves.toEqual([{ id: 'u1' }]);
  });

  describe('refreshAccessToken', () => {
    const activeUser = (token, extra = {}) => ({
      id: 'u1',
      email: 'a@b.tn',
      role: 'user',
      is_active: true,
      refreshToken: token,
      ...extra,
    });

    it('exige un jeton', async () => {
      await expect(userService.refreshAccessToken()).rejects.toMatchObject({ statusCode: 401 });
    });

    it('fait tourner les jetons quand le jeton enregistré correspond', async () => {
      const token = userService.createRefreshToken('u1');
      userRepository.findByIdWithPassword.mockResolvedValue(activeUser(token));

      const res = await userService.refreshAccessToken(token);

      expect(jwt.verify(res.accessToken, 'test-secret').id).toBe('u1');
      expect(jwt.verify(res.refreshToken, 'refresh-secret').id).toBe('u1');
      expect(userRepository.update).toHaveBeenCalledWith('u1', { refreshToken: res.refreshToken });
      expect(res.user).toEqual({ id: 'u1', email: 'a@b.tn', role: 'user', status: true });
    });

    it.each([
      ['jeton signé avec un autre secret', () => jwt.sign({ id: 'u1' }, 'autre'), null],
      ['utilisateur supprimé', () => userService.createRefreshToken('u1'), () => null],
      [
        'compte inactif',
        () => userService.createRefreshToken('u1'),
        (t) => activeUser(t, { is_active: false }),
      ],
      [
        'jeton déjà remplacé',
        () => userService.createRefreshToken('u1'),
        () => activeUser('ancien'),
      ],
    ])('refuse : %s', async (_label, makeToken, makeUser) => {
      const token = makeToken();
      if (makeUser) userRepository.findByIdWithPassword.mockResolvedValue(makeUser(token));
      await expect(userService.refreshAccessToken(token)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Refresh token invalide ou expiré',
      });
      expect(userRepository.update).not.toHaveBeenCalled();
    });
  });

  it('logoutUser efface le jeton de rafraîchissement seulement avec un id', async () => {
    await userService.logoutUser();
    expect(userRepository.update).not.toHaveBeenCalled();
    await userService.logoutUser('u1');
    expect(userRepository.update).toHaveBeenCalledWith('u1', { refreshToken: null });
  });

  describe('deleteUser', () => {
    it('interdit de supprimer son propre compte', async () => {
      await expect(userService.deleteUser('u1', 'u1')).rejects.toMatchObject({ statusCode: 403 });
    });

    it('supprime un utilisateur existant ou renvoie 404', async () => {
      userRepository.findById.mockResolvedValueOnce(null);
      await expect(userService.deleteUser('u2', 'u1')).rejects.toMatchObject({ statusCode: 404 });
      userRepository.findById.mockResolvedValueOnce({ id: 'u2' });
      await userService.deleteUser('u2', 'u1');
      expect(userRepository.deleteById).toHaveBeenCalledWith('u2');
    });
  });

  it('toPublicUser applique les valeurs par défaut', () => {
    expect(
      userService.toPublicUser({
        id: 'u1',
        username: 'a',
        email: 'e',
        role: 'user',
        is_active: true,
      })
    ).toEqual({
      id: 'u1',
      username: 'a',
      email: 'e',
      phone: null,
      role: 'user',
      company_role: 'OWNER',
      companyId: null,
      company_name: null,
      status: true,
    });
  });
});
