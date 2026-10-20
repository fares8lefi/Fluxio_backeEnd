jest.mock('../../../src/repositories/userRepository', () => ({ findById: jest.fn() }));
jest.mock('../../../src/services/userService', () => ({ refreshAccessToken: jest.fn() }));
const jwt = require('jsonwebtoken');
const userRepository = require('../../../src/repositories/userRepository');
const userService = require('../../../src/services/userService');
const { requireAuthUser } = require('../../../src/middlewares/authMiddelwares');

const SECRET = 'test-secret';

/** Exécute le middleware et attend la réponse ou next() */
const run = (req) =>
  new Promise((resolve) => {
    const res = {
      cookie: jest.fn(),
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(() => resolve({ res, next })),
    };
    const next = jest.fn(() => resolve({ res, next }));
    requireAuthUser(Object.assign(req, { cookies: {}, headers: {}, body: {}, ...req }), res, next);
  });

const expired = () => jwt.sign({ id: 'u1', exp: Math.floor(Date.now() / 1000) - 60 }, SECRET);

describe('requireAuthUser', () => {
  const env = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...env, net_Secret: SECRET };
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    process.env = env;
  });

  it('refuse une requête sans jeton', async () => {
    const { res, next } = await run({});
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['cookie', (t) => ({ cookies: { jwt_login: t } })],
    ['en-tête Bearer', (t) => ({ headers: { authorization: `Bearer ${t}` } })],
    ['corps de requête', (t) => ({ body: { token: t } })],
  ])('authentifie un jeton valide transmis par %s', async (_label, place) => {
    userRepository.findById.mockResolvedValue({ id: 'u1', is_active: true });
    const req = { session: {}, ...place(jwt.sign({ id: 'u1' }, SECRET)) };
    const { next } = await run(req);
    expect(next).toHaveBeenCalled();
    expect(userRepository.findById).toHaveBeenCalledWith('u1');
    expect(req.user).toEqual({ id: 'u1', is_active: true });
    expect(req.session.user).toEqual(req.user);
  });

  it('refuse un jeton invalide', async () => {
    const { res } = await run({ cookies: { jwt_login: jwt.sign({ id: 'u1' }, 'autre') } });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Token invalide' });
  });

  it.each([
    ['utilisateur supprimé', null, 401],
    ['compte non activé', { id: 'u1', is_active: false }, 403],
  ])('refuse un jeton valide pour un %s', async (_label, user, status) => {
    userRepository.findById.mockResolvedValue(user);
    const { res } = await run({ cookies: { jwt_login: jwt.sign({ id: 'u1' }, SECRET) } });
    expect(res.status).toHaveBeenCalledWith(status);
  });

  it('renvoie 500 si la base est indisponible', async () => {
    userRepository.findById.mockRejectedValue(new Error('db down'));
    const { res } = await run({ cookies: { jwt_login: jwt.sign({ id: 'u1' }, SECRET) } });
    expect(res.status).toHaveBeenCalledWith(500);
  });

  describe('jeton expiré', () => {
    it('refuse sans jeton de rafraîchissement', async () => {
      const { res } = await run({ cookies: { jwt_login: expired() } });
      expect(res.status).toHaveBeenCalledWith(401);
      expect(userService.refreshAccessToken).not.toHaveBeenCalled();
    });

    it('rafraîchit la session et pose les nouveaux cookies', async () => {
      userService.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        user: { id: 'u1' },
      });
      userRepository.findById.mockResolvedValue({ id: 'u1', is_active: true });
      const req = { session: {}, cookies: { jwt_login: expired(), jwt_refresh: 'old-refresh' } };

      const { res, next } = await run(req);

      expect(userService.refreshAccessToken).toHaveBeenCalledWith('old-refresh');
      expect(res.cookie).toHaveBeenCalledWith('jwt_login', 'new-access', expect.any(Object));
      expect(res.cookie).toHaveBeenCalledWith('jwt_refresh', 'new-refresh', expect.any(Object));
      expect(res.setHeader).toHaveBeenCalledWith('X-Token-Refreshed', 'true');
      expect(next).toHaveBeenCalled();
      expect(req.session.user).toEqual({ id: 'u1', is_active: true });
    });

    it('lit le jeton de rafraîchissement depuis x-refresh-token ou le corps', async () => {
      userService.refreshAccessToken.mockRejectedValue(new Error('invalid'));
      await run({
        cookies: { jwt_login: expired() },
        headers: { 'x-refresh-token': 'Bearer hdr' },
      });
      expect(userService.refreshAccessToken).toHaveBeenLastCalledWith('hdr');
      await run({ cookies: { jwt_login: expired() }, body: { refreshToken: 'body' } });
      expect(userService.refreshAccessToken).toHaveBeenLastCalledWith('body');
    });

    it.each([
      ['utilisateur supprimé', null, 401],
      ['compte non activé', { id: 'u1', is_active: false }, 403],
    ])('refuse après rafraîchissement pour un %s', async (_label, user, status) => {
      userService.refreshAccessToken.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
        user: { id: 'u1' },
      });
      userRepository.findById.mockResolvedValue(user);
      const { res, next } = await run({ cookies: { jwt_login: expired(), jwt_refresh: 'r' } });
      expect(res.status).toHaveBeenCalledWith(status);
      expect(next).not.toHaveBeenCalled();
    });

    it('refuse si le rafraîchissement échoue', async () => {
      userService.refreshAccessToken.mockRejectedValue(new Error('invalid'));
      const { res } = await run({ cookies: { jwt_login: expired(), jwt_refresh: 'r' } });
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Token expiré — veuillez vous reconnecter',
      });
    });
  });
});
