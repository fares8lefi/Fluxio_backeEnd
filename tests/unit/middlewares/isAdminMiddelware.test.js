const { isAdmin } = require('../../../src/middlewares/isAdminMiddelware');

const run = (req) => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  isAdmin(req, res, next);
  return { res, next };
};

describe('isAdmin', () => {
  it('laisse passer un admin actif (req.user ou session)', () => {
    expect(run({ user: { role: 'admin', is_active: true } }).next).toHaveBeenCalled();
    expect(run({ session: { user: { role: 'admin' } } }).next).toHaveBeenCalled();
  });

  it.each([
    ['sans utilisateur', {}, 401],
    ['un utilisateur standard', { user: { role: 'user' } }, 403],
    ['un admin suspendu', { user: { role: 'admin', is_active: false } }, 403],
  ])('refuse %s', (_label, req, status) => {
    const { res, next } = run(req);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(status);
  });

  it('renvoie 500 si la lecture de la session échoue', () => {
    const req = {};
    Object.defineProperty(req, 'session', {
      get() {
        throw new Error('boom');
      },
    });
    expect(run(req).res.status).toHaveBeenCalledWith(500);
  });
});
