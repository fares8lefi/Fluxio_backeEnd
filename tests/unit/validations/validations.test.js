const {
  validateProductRegistration,
  validateProductUpdate,
  validateProductSearch,
} = require('../../../src/validations/ProductValidations');
const {
  validateCategorieRegistration,
  validateCategorieUpdate,
} = require('../../../src/validations/CategorieValidations');
const {
  validateMouvmentRegistration,
  validateMouvmentUpdate,
} = require('../../../src/validations/mouvmentValidations');
const {
  validateUserRegistration,
  validateUserUpdate,
  validatePassword,
  validateLogin,
} = require('../../../src/validations/UserValidations');
const {
  validateClientRegistration,
  validateClientUpdate,
} = require('../../../src/validations/ClientValidations');

describe('ProductValidations', () => {
  const product = {
    code: ' 12 ',
    barcode: 619,
    name: ' Huile ',
    purchase_price: 2,
    selling_price: 3,
    stock_min: 1,
  };

  it('accepte un produit et applique les valeurs par défaut', () => {
    const res = validateProductRegistration(product);
    expect(res.isValid).toBe(true);
    expect(res.data).toMatchObject({
      code: 12,
      name: 'Huile',
      stock_quantity: 0,
      tva_rate: 19,
      unit_of_measure: 'pièce',
    });
  });

  it('signale un message par champ invalide', () => {
    const res = validateProductRegistration({
      ...product,
      code: 'abc',
      barcode: '0',
      tva_rate: 10,
      stock_min: 1.5,
    });
    expect(res.isValid).toBe(false);
    expect(res.data).toBeNull();
    expect(Object.keys(res.errors).sort()).toEqual(['barcode', 'code', 'stock_min', 'tva_rate']);
  });

  it('mise à jour : champs optionnels mais contrôlés', () => {
    expect(validateProductUpdate({}).isValid).toBe(true);
    expect(validateProductUpdate({ code: '5', barcode: '7', tva_rate: 7 }).data).toMatchObject({
      code: 5,
      barcode: 7,
    });
    const bad = validateProductUpdate({ code: '-1', barcode: 'x', tva_rate: 5, name: '' });
    expect(Object.keys(bad.errors).sort()).toEqual(['barcode', 'code', 'name', 'tva_rate']);
  });

  it('recherche : convertit les paramètres de requête', () => {
    expect(validateProductSearch({ stock_quantity: '3', maxPrice: '9.5' }).data).toEqual({
      stock_quantity: 3,
      maxPrice: 9.5,
    });
    expect(validateProductSearch({ minPrice: '-1' }).isValid).toBe(false);
  });
});

describe('CategorieValidations', () => {
  it('création : nom et code entier positif requis', () => {
    expect(validateCategorieRegistration({ name: 'Épicerie', code: '3' })).toEqual({
      errors: {},
      isValid: true,
    });
    expect(validateCategorieRegistration({ name: ' ', code: 'x' }).errors).toEqual({
      name: expect.any(String),
      code: 'Le code doit être un entier positif',
    });
  });

  it('mise à jour : tout est optionnel', () => {
    expect(validateCategorieUpdate({}).isValid).toBe(true);
    expect(validateCategorieUpdate({ code: 4, description: null }).isValid).toBe(true);
    expect(validateCategorieUpdate({ code: '0' }).errors).toHaveProperty('code');
  });
});

describe('mouvmentValidations', () => {
  const mouvment = {
    type: 'IN',
    items: [{ productId: 'p1', quantity: 2 }],
    createdById: 'u1',
  };

  it('accepte un mouvement valide avec facture fournisseur', () => {
    expect(
      validateMouvmentRegistration({
        ...mouvment,
        supplier_invoice_ref: 'FA-1',
        supplier_invoice_date: '2026-10-01',
      }).isValid
    ).toBe(true);
    expect(validateMouvmentRegistration({ ...mouvment, supplier_invoice_date: '' }).isValid).toBe(
      true
    );
  });

  it('refuse type, lignes et date invalides', () => {
    const res = validateMouvmentRegistration({
      type: 'GIFT',
      items: [{ productId: 'p1', quantity: 0 }],
      supplier_invoice_date: 'hier',
    });
    expect(Object.keys(res.errors).sort()).toEqual([
      'createdById',
      'items',
      'supplier_invoice_date',
      'type',
    ]);
    expect(validateMouvmentRegistration({ ...mouvment, items: [] }).errors.items).toBe(
      'Au moins un article est requis'
    );
  });

  it('mise à jour : contrôle les champs fournis', () => {
    expect(validateMouvmentUpdate({}).isValid).toBe(true);
    expect(validateMouvmentUpdate({ status: 'CANCELLED' }).isValid).toBe(true);
    expect(validateMouvmentUpdate({ status: 'DONE', items: [] }).errors).toEqual({
      status: expect.any(String),
      items: expect.any(String),
    });
  });
});

describe('UserValidations', () => {
  it("inscription : contrôle l'email, le mot de passe et le téléphone", () => {
    const ok = {
      username: 'demo',
      email: 'demo@atlas.tn',
      password: 'Secret123',
      phone: '+216 71 000 000',
      company_name: 'Atlas',
      matriculeFiscale: 'MF',
    };
    expect(validateUserRegistration(ok).isValid).toBe(true);
    const bad = validateUserRegistration({ ...ok, email: 'x', password: 'court', phone: 'abc' });
    expect(bad.errors).toEqual({
      email: 'Email is invalid',
      password: 'Password must be at least 8 characters',
      phone: 'Phone number is invalid',
    });
  });

  it('mise à jour, mot de passe et connexion', () => {
    expect(validateUserUpdate({}).isValid).toBe(true);
    expect(validateUserUpdate({ email: 'x' }).errors).toHaveProperty('email');
    expect(validatePassword('Secret123').isValid).toBe(true);
    expect(validatePassword('court').errors).toHaveProperty('password');
    expect(validateLogin({ email: 'a@b.tn', password: 'x' }).isValid).toBe(true);
    expect(validateLogin({ email: 'a@b.tn', password: '' }).errors).toEqual({
      password: 'Password is required',
    });
  });
});

describe('ClientValidations', () => {
  it('création : nom, téléphone et matricule requis', () => {
    expect(
      validateClientRegistration({ name: 'A', phone: '71', matriculeFiscale: 'MF' }).isValid
    ).toBe(true);
    expect(Object.keys(validateClientRegistration({}).errors).sort()).toEqual([
      'matriculeFiscale',
      'name',
      'phone',
    ]);
  });

  it('mise à jour : champs optionnels', () => {
    expect(validateClientUpdate({ is_active: false, codeTva: null }).isValid).toBe(true);
    expect(validateClientUpdate({ name: '', is_active: 'oui' }).errors).toEqual({
      name: expect.any(String),
      is_active: expect.any(String),
    });
  });
});
