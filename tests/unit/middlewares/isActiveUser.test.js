const { isActiveUser } = require('../../../src/middlewares/isActiveUser');

const run = (req) => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  isActiveUser(req, res, next);
  return { res, next };
};

describe('isActiveUser', () => {
  it('laisse passer sans utilisateur, pour un admin ou un compte actif', () => {
    expect(run({ method: 'POST' }).next).toHaveBeenCalled();
    expect(
      run({ method: 'DELETE', user: { role: 'admin', is_active: false } }).next
    ).toHaveBeenCalled();
    expect(run({ method: 'PUT', user: { role: 'user', is_active: true } }).next).toHaveBeenCalled();
  });

  it('autorise la lecture pour un compte suspendu', () => {
    expect(
      run({ method: 'GET', session: { user: { role: 'user', is_active: false } } }).next
    ).toHaveBeenCalled();
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('bloque %s pour un compte suspendu', (method) => {
    const { res, next } = run({ method, user: { role: 'user', is_active: false } });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
