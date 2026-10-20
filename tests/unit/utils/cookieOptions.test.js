const { authCookieOptions } = require('../../../src/utils/cookieOptions');

describe('authCookieOptions', () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it('en développement : httpOnly, lax, non sécurisé', () => {
    process.env = { ...env, NODE_ENV: 'development' };
    delete process.env.COOKIE_SAMESITE;
    expect(authCookieOptions(1000)).toEqual({
      httpOnly: true,
      maxAge: 1000,
      sameSite: 'lax',
      secure: false,
    });
  });

  it('en production : cookie sécurisé', () => {
    process.env = { ...env, NODE_ENV: 'production', COOKIE_SAMESITE: 'Strict' };
    expect(authCookieOptions(5)).toMatchObject({ sameSite: 'strict', secure: true });
  });

  it('sameSite=none impose secure même hors production', () => {
    process.env = { ...env, NODE_ENV: 'development', COOKIE_SAMESITE: 'NONE' };
    expect(authCookieOptions(5)).toMatchObject({ sameSite: 'none', secure: true });
  });
});
