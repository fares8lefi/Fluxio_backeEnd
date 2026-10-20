const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');

// Authentification simulée : l'en-tête x-test-role fixe le rôle dans l'entreprise
jest.mock('../../../src/middlewares/authMiddelwares', () => ({
  requireAuthUser: (req, res, next) => {
    req.user = { id: 'u1', companyId: 'c1', role: 'user', company_role: req.get('x-test-role') };
    next();
  },
}));
jest.mock('../../../src/services/exportService');
jest.mock('../../../src/services/teamService');
jest.mock(
  '../../../src/controllers/userController',
  () =>
    new Proxy(
      {},
      {
        get: (target, name) =>
          target[name] ??
          (target[name] = jest.fn((req, res) =>
            res.status(200).json({ handler: name, user: req.user })
          )),
      }
    )
);
const exportService = require('../../../src/services/exportService');
const teamService = require('../../../src/services/teamService');

const appWith = (path, router) => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(path, router);
  return app;
};

const exportApp = appWith('/exports', require('../../../src/routes/exportRouter'));
const teamApp = appWith('/team', require('../../../src/routes/teamRouter'));
const usersApp = appWith('/users', require('../../../src/routes/usersRouter'));

const httpError = (message, statusCode, extra = {}) =>
  Object.assign(new Error(message), { statusCode }, extra);

beforeEach(() => jest.clearAllMocks());

describe('exportRouter', () => {
  it.each([
    ['/sales-journal', 'salesJournal'],
    ['/vat-summary', 'vatSummary'],
    ['/products', 'products'],
    ['/clients', 'clients'],
    ['/movements', 'movements'],
  ])('GET %s envoie le CSV en téléchargement', async (path, fn) => {
    exportService[fn].mockResolvedValue({ csv: 'a;b\r\n', filename: 'export.csv' });
    const res = await request(exportApp).get(`/exports${path}?from=2026-01-01`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toBe('attachment; filename="export.csv"');
    expect(res.text).toBe('a;b\r\n');
    expect(exportService[fn]).toHaveBeenCalledWith('c1', { from: '2026-01-01' });
  });

  it('réserve les exports fiscaux aux gérants et comptables', async () => {
    const res = await request(exportApp).get('/exports/vat-summary').set('x-test-role', 'STOCK');
    expect(res.status).toBe(403);
    expect(exportService.vatSummary).not.toHaveBeenCalled();
  });

  it("renvoie l'erreur du service en JSON", async () => {
    exportService.vatSummary.mockRejectedValueOnce(httpError('Mois invalide', 400));
    let res = await request(exportApp).get('/exports/vat-summary');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'Mois invalide' });

    exportService.products.mockRejectedValueOnce(new Error('db'));
    res = await request(exportApp).get('/exports/products');
    expect(res.status).toBe(500);
  });
});

describe('teamRouter', () => {
  const owner = { id: 'u1', companyId: 'c1', role: 'user', company_role: undefined };

  it("GET /invitations/preview est public et lit le jeton de l'URL", async () => {
    teamService.previewInvitation.mockResolvedValue({ email: 'c@atlas.tn' });
    const res = await request(teamApp).get('/team/invitations/preview?token=abc');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, email: 'c@atlas.tn' });
    expect(teamService.previewInvitation).toHaveBeenCalledWith('abc');
  });

  it('POST /invitations/accept crée le compte (201)', async () => {
    teamService.acceptInvitation.mockResolvedValue({ id: 'u2' });
    const res = await request(teamApp)
      .post('/team/invitations/accept')
      .send({ token: 'abc', username: 'neo' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, user: { id: 'u2' } });
    expect(teamService.acceptInvitation).toHaveBeenCalledWith({ token: 'abc', username: 'neo' });
  });

  it('renvoie les erreurs de validation dans errors', async () => {
    teamService.acceptInvitation.mockRejectedValue(
      httpError('Données invalides', 400, { details: { password: 'trop court' } })
    );
    const res = await request(teamApp).post('/team/invitations/accept').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'Données invalides',
      errors: { password: 'trop court' },
    });

    teamService.previewInvitation.mockRejectedValue(new Error('db'));
    expect((await request(teamApp).get('/team/invitations/preview')).status).toBe(500);
  });

  it.each([
    ['get', '/team', 'listTeam', () => ['c1'], 200, { members: [] }, { members: [] }],
    [
      'post',
      '/team/invitations',
      'invite',
      () => [owner, { email: 'a@b.tn' }],
      201,
      { link: 'l' },
      { link: 'l' },
    ],
    [
      'delete',
      '/team/invitations/inv1',
      'revokeInvitation',
      () => [owner, 'inv1'],
      200,
      { id: 'inv1' },
      { id: 'inv1' },
    ],
    [
      'patch',
      '/team/members/u2',
      'updateMemberRole',
      () => [owner, 'u2', 'STOCK'],
      200,
      { id: 'u2' },
      { member: { id: 'u2' } },
    ],
    [
      'delete',
      '/team/members/u2',
      'removeMember',
      () => [owner, 'u2'],
      200,
      { id: 'u2' },
      { id: 'u2' },
    ],
  ])('%s %s → teamService.%s', async (method, path, fn, args, status, result, body) => {
    teamService[fn].mockResolvedValue(result);
    const agent = request(teamApp);
    const res = await agent[method](path).send({ email: 'a@b.tn', company_role: 'STOCK' });
    expect(res.status).toBe(status);
    expect(res.body).toEqual({ success: true, ...body });
    const expected = args();
    if (fn === 'invite') expected[1] = { email: 'a@b.tn', company_role: 'STOCK' };
    expect(teamService[fn]).toHaveBeenCalledWith(...expected);
  });

  it("réserve la gestion de l'équipe au gérant", async () => {
    const res = await request(teamApp).get('/team').set('x-test-role', 'ACCOUNTANT');
    expect(res.status).toBe(403);
    expect(teamService.listTeam).not.toHaveBeenCalled();
  });
});

describe('usersRouter — GET /me', () => {
  it('répond « pas de session » sans cookie ni en-tête', async () => {
    const res = await request(usersApp).get('/users/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, user: null });
  });

  it.each([
    ['cookie jwt_login', (r) => r.set('Cookie', 'jwt_login=tok')],
    ['cookie jwt_refresh', (r) => r.set('Cookie', 'jwt_refresh=tok')],
    ['en-tête Authorization', (r) => r.set('Authorization', 'Bearer tok')],
  ])('passe à l’authentification avec un %s', async (_label, withAuth) => {
    const res = await withAuth(request(usersApp).get('/users/me'));
    expect(res.status).toBe(200);
    expect(res.body.handler).toBe('getMe');
    expect(res.body.user).toMatchObject({ id: 'u1' });
  });
});
