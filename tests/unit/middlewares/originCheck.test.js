const {
  originCheck,
  allowedOrigins,
  isAllowedOrigin,
} = require('../../../src/middlewares/originCheck');

const run = (method, headers = {}) => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  originCheck({ method, headers }, res, next);
  return { res, next };
};

describe('originCheck', () => {
  const env = process.env.FRONTEND_URL;
  beforeEach(() => {
    process.env.FRONTEND_URL = 'https://app.fluxio.tn/, http://localhost:5173';
  });
  afterAll(() => {
    process.env.FRONTEND_URL = env;
  });

  it('normalise la liste des origines autorisées', () => {
    expect(allowedOrigins()).toEqual(['https://app.fluxio.tn', 'http://localhost:5173']);
  });

  it('laisse passer les lectures quelle que soit l’origine', () => {
    expect(run('GET', { origin: 'https://evil.example' }).next).toHaveBeenCalled();
  });

  it('autorise une écriture depuis le frontend ou sans origine (client non navigateur)', () => {
    expect(run('POST', { origin: 'https://app.fluxio.tn' }).next).toHaveBeenCalled();
    expect(run('PUT', { referer: 'http://localhost:5173/#/clients' }).next).toHaveBeenCalled();
    expect(run('DELETE').next).toHaveBeenCalled();
  });

  it('tolère un point final et la casse dans FRONTEND_URL', () => {
    process.env.FRONTEND_URL = 'https://Fluxio-Rust.vercel.app.';
    expect(allowedOrigins()).toEqual(['https://fluxio-rust.vercel.app']);
    expect(isAllowedOrigin('https://fluxio-rust.vercel.app')).toBe(true);
  });

  it('accepte « * » pour un segment du nom d’hôte (aperçus Vercel)', () => {
    process.env.FRONTEND_URL = 'https://fluxio-*-team.vercel.app';
    expect(isAllowedOrigin('https://fluxio-git-main-team.vercel.app')).toBe(true);
    expect(isAllowedOrigin('https://fluxio-abc123-team.vercel.app')).toBe(true);
    expect(isAllowedOrigin('https://fluxio-x.evil.com-team.vercel.app')).toBe(false);
    expect(isAllowedOrigin('https://fluxio-x-team.vercel.app.evil.com')).toBe(false);
    expect(isAllowedOrigin('http://fluxio-x-team.vercel.app')).toBe(false);
  });

  it.each([
    { origin: 'https://evil.example' },
    { referer: 'https://evil.example/page' },
    { referer: 'pas une url' },
  ])('refuse une écriture d’une autre origine (%o)', (headers) => {
    const { res, next } = run('POST', headers);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
