const {
  canWriteStock,
  canWriteBilling,
  ownerOnly,
} = require('../../../src/middlewares/companyRole');

const run = (mw, user) => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  mw({ user }, res, next);
  return { next, res };
};

describe('companyRole', () => {
  it.each([
    [canWriteStock, 'STOCK', true],
    [canWriteStock, 'ACCOUNTANT', false],
    [canWriteBilling, 'ACCOUNTANT', true],
    [canWriteBilling, 'STOCK', false],
    [ownerOnly, 'ACCOUNTANT', false],
    [ownerOnly, 'OWNER', true],
  ])('%#: rôle %s → autorisé %s', (mw, role, allowed) => {
    const { next, res } = run(mw, { role: 'user', company_role: role });
    expect(next).toHaveBeenCalledTimes(allowed ? 1 : 0);
    if (!allowed) expect(res.status).toHaveBeenCalledWith(403);
  });

  it("les comptes sans rôle (historiques) sont gérants ; l'admin plateforme passe", () => {
    expect(run(ownerOnly, { role: 'user' }).next).toHaveBeenCalled();
    expect(
      run(canWriteStock, { role: 'admin', company_role: 'ACCOUNTANT' }).next
    ).toHaveBeenCalled();
  });
});
