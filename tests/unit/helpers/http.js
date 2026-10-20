/** Requête Express minimale : utilisateur connecté de la société c1 */
const mockReq = (overrides = {}) => ({
  user: { id: 'u1', companyId: 'c1', role: 'user' },
  params: {},
  query: {},
  body: {},
  cookies: {},
  headers: {},
  ...overrides,
});

/** Réponse Express chaînable dont chaque méthode est espionnée */
const mockRes = () => {
  const res = {};
  [
    'status',
    'json',
    'send',
    'cookie',
    'clearCookie',
    'setHeader',
    'set',
    'type',
    'attachment',
  ].forEach((method) => {
    res[method] = jest.fn(() => res);
  });
  return res;
};

/** Erreur métier telle que la lèvent les services */
const httpError = (message, statusCode, extra = {}) =>
  Object.assign(new Error(message), { statusCode }, extra);

module.exports = { mockReq, mockRes, httpError };
