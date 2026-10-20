/**
 * Faux client Prisma pour les tests de repositories : chaque `prisma.<modèle>.<méthode>`
 * est un jest.fn() créé à la première lecture (résolu à `undefined` par défaut).
 * Usage : jest.mock('../../../config/db', () => require('../helpers/prismaMock')());
 */
const createPrismaMock = () => {
  const models = {};
  const model = () =>
    new Proxy(
      {},
      {
        get(target, method) {
          if (!(method in target)) target[method] = jest.fn().mockResolvedValue(undefined);
          return target[method];
        },
      }
    );
  return new Proxy(models, {
    get(target, name) {
      if (name === '__esModule') return false;
      // $transaction, $queryRaw… sont des méthodes du client, pas des modèles
      if (!(name in target)) {
        target[name] =
          typeof name === 'string' && name.startsWith('$')
            ? jest.fn().mockResolvedValue(undefined)
            : model();
      }
      return target[name];
    },
  });
};

module.exports = createPrismaMock;
