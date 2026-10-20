jest.mock('../../../src/services/userService');
const userService = require('../../../src/services/userService');
const userController = require('../../../src/controllers/userController');
const { mockReq, mockRes, httpError } = require('../helpers/http');

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

const call = async (handler, req) => {
  const res = mockRes();
  await userController[handler](mockReq(req), res);
  return res;
};

/** [handler, fonction du service, requête, arguments attendus] — réponse 200 attendue */
const simpleCases = [
  ['createUser', 'createUser', { body: { email: 'a@b.tn' } }, [{ email: 'a@b.tn' }]],
  ['verifyAccounts', 'verifyAccounts', { body: { email: 'a@b.tn', code: '1' } }, ['a@b.tn', '1']],
  ['resendCode', 'resendCode', { body: { email: 'a@b.tn' } }, ['a@b.tn']],
  ['forgetPassword', 'forgetPassword', { body: { email: 'a@b.tn' } }, ['a@b.tn']],
  [
    'foorgetPasswordVerifyCode',
    'forgetPasswordVerifyCode',
    { body: { email: 'a@b.tn', code: '1', newPassword: 'Secret123' } },
    ['a@b.tn', '1', 'Secret123'],
  ],
  ['getConnectedUser', 'getConnectedUser', { query: { id: 'u1' } }, ['u1']],
  [
    'changePassword',
    'changePassword',
    { body: { currentPassord: 'old', newPassword: 'Secret123' } },
    ['u1', 'old', 'Secret123'],
  ],
  [
    'updatePersonnelData',
    'updatePersonnelData',
    { body: { password: 'pwd', phone: '71' } },
    ['u1', { phone: '71' }, 'pwd'],
  ],
  ['updateUserStatus', 'updateUserStatus', {}, ['u1']],
  ['getAllUsers', 'getAllUsers', {}, []],
  ['deleteUser', 'deleteUser', { params: { id: 'u2' } }, ['u2', 'u1']],
];

describe.each(simpleCases)('userController.%s', (handler, serviceFn, req, args) => {
  it(`appelle userService.${serviceFn} et renvoie 200`, async () => {
    userService[serviceFn].mockResolvedValueOnce([]);
    const res = await call(handler, req);
    expect(userService[serviceFn]).toHaveBeenCalledWith(...args);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it("propage l'erreur du service", async () => {
    userService[serviceFn].mockRejectedValueOnce(httpError('Refusé', 403));
    const res = await call(handler, req);
    // getAllUsers renvoie toujours 500
    expect(res.status).toHaveBeenCalledWith(handler === 'getAllUsers' ? 500 : 403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('renvoie 500 pour une erreur inattendue', async () => {
    userService[serviceFn].mockRejectedValueOnce(new Error('boom'));
    const res = await call(handler, req);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('userController — cas particuliers', () => {
  it.each(['createUser', 'foorgetPasswordVerifyCode', 'changePassword', 'updatePersonnelData'])(
    '%s renvoie les erreurs de validation dans errors',
    async (handler) => {
      const fn = simpleCases.find(([h]) => h === handler)[1];
      userService[fn].mockRejectedValueOnce(
        httpError('Validation échouée', 400, { details: { a: 'b' } })
      );
      const res = await call(handler, { body: {} });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errors: { a: 'b' } }));
    }
  );

  it("forgetPassword exige l'email", async () => {
    const res = await call('forgetPassword', { body: {} });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(userService.forgetPassword).not.toHaveBeenCalled();
  });

  describe('loginUser', () => {
    it('pose les cookies et renvoie les jetons', async () => {
      userService.loginUser.mockResolvedValue({
        user: { id: 'u1' },
        accessToken: 'acc',
        refreshToken: 'ref',
        maxTime: 100,
      });
      const res = await call('loginUser', { body: { email: 'a@b.tn', password: 'x' } });
      expect(res.cookie).toHaveBeenCalledWith(
        'jwt_login',
        'acc',
        expect.objectContaining({ httpOnly: true, maxAge: 15 * 60 * 1000 })
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'jwt_refresh',
        'ref',
        expect.objectContaining({ maxAge: 100000 })
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        user: { id: 'u1' },
        token: 'acc',
        accessToken: 'acc',
        refreshToken: 'ref',
      });
    });

    it('refuse des identifiants incorrects sans poser de cookie', async () => {
      userService.loginUser.mockRejectedValueOnce(
        httpError('Email ou mot de passe incorrect', 401, { details: { email: 'x' } })
      );
      const res = await call('loginUser', { body: {} });
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errors: { email: 'x' } }));

      userService.loginUser.mockRejectedValueOnce(new Error('boom'));
      expect((await call('loginUser', {})).status).toHaveBeenCalledWith(500);
    });
  });

  describe('getMe', () => {
    it("renvoie l'utilisateur public de la requête ou de la session", async () => {
      userService.toPublicUser.mockReturnValue({ id: 'u1', public: true });
      const res = await call('getMe', {});
      expect(res.json).toHaveBeenCalledWith({ success: true, user: { id: 'u1', public: true } });

      await call('getMe', { user: undefined, session: { user: { id: 'u9' } } });
      expect(userService.toPublicUser).toHaveBeenLastCalledWith({ id: 'u9' });
    });

    it('renvoie null sans utilisateur et 500 si la conversion échoue', async () => {
      let res = await call('getMe', { user: undefined });
      expect(res.json).toHaveBeenCalledWith({ success: true, user: null });

      userService.toPublicUser.mockImplementation(() => {
        throw new Error('boom');
      });
      res = await call('getMe', {});
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('logOutUser', () => {
    it('révoque le jeton et efface les cookies', async () => {
      const res = await call('logOutUser', {});
      expect(userService.logoutUser).toHaveBeenCalledWith('u1');
      expect(res.cookie).toHaveBeenCalledWith(
        'jwt_login',
        '',
        expect.objectContaining({ maxAge: 1 })
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'jwt_refresh',
        '',
        expect.objectContaining({ maxAge: 1 })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('efface les cookies même sans utilisateur et renvoie 500 si la révocation échoue', async () => {
      await call('logOutUser', { user: undefined });
      expect(userService.logoutUser).not.toHaveBeenCalled();

      userService.logoutUser.mockRejectedValueOnce(new Error('db'));
      expect((await call('logOutUser', {})).status).toHaveBeenCalledWith(500);
    });
  });

  describe('refreshToken', () => {
    const rotated = { accessToken: 'a2', refreshToken: 'r2', user: { id: 'u1' } };

    it('refuse sans jeton', async () => {
      const res = await call('refreshToken', {});
      expect(res.status).toHaveBeenCalledWith(401);
      expect(userService.refreshAccessToken).not.toHaveBeenCalled();
    });

    it.each([
      ['cookie', { cookies: { jwt_refresh: 'tok' } }],
      ['corps', { body: { refreshToken: 'tok' } }],
      ['en-tête Bearer', { headers: { authorization: 'Bearer tok' } }],
      ['en-tête brut', { headers: { x_refresh_token: 'tok' } }],
    ])('lit le jeton depuis le %s et pose les nouveaux cookies', async (_label, req) => {
      userService.refreshAccessToken.mockResolvedValueOnce(rotated);
      const res = await call('refreshToken', req);
      expect(userService.refreshAccessToken).toHaveBeenCalledWith('tok');
      expect(res.cookie).toHaveBeenCalledWith('jwt_login', 'a2', expect.any(Object));
      expect(res.cookie).toHaveBeenCalledWith('jwt_refresh', 'r2', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'a2' }));
    });

    it('propage le refus du service', async () => {
      userService.refreshAccessToken.mockRejectedValueOnce(httpError('invalide', 401));
      const res = await call('refreshToken', { cookies: { jwt_refresh: 'tok' } });
      expect(res.status).toHaveBeenCalledWith(401);
      userService.refreshAccessToken.mockRejectedValueOnce(new Error('boom'));
      expect(
        (await call('refreshToken', { cookies: { jwt_refresh: 'tok' } })).status
      ).toHaveBeenCalledWith(500);
    });
  });
});
