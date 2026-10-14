const {
  validateSupplierRegistration,
  validateSupplierUpdate,
} = require('../../../src/validations/SuppliersValidations');

const base = { name: 'Fournisseur', email: 'f@b.tn', phone: '71000000', address: 'Sfax' };

describe('Matricule fiscal fournisseur', () => {
  it.each([
    ['1234567A/A/M/000'],
    ['1234567s/a/m/000'], // la lettre S ne doit pas être supprimée (régression)
    [' 1234567A A M 000 '], // espaces retirés
    [''], // facultatif
  ])('accepte %j', (mf) => {
    expect(validateSupplierRegistration({ ...base, matriculeFiscale: mf }).isValid).toBe(true);
  });

  it('refuse un format inconnu', () => {
    expect(validateSupplierUpdate({ matriculeFiscale: 'mf25126' }).errors.matriculeFiscale).toBe(
      'Format attendu : 1234567A/A/M/000'
    );
  });
});
