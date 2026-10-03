const {
  computeInvoiceReadiness,
  getCompanyMissingFields,
} = require('../../../src/utils/invoiceReadiness');

const fullCompany = {
  matriculeFiscale: '1234567A/P/M000',
  address: '10 rue de Tunis',
  phone: '71234567',
};

const fullClient = {
  name: 'Société Cliente',
  matriculeFiscale: '9876543B/P/M000',
  address: '20 avenue de Carthage',
  codeTva: 'CM1234567',
  phone: '70123456',
};

const movementWithItems = {
  id: 'mvt-1',
  items: [
    {
      id: 'item-1',
      productId: 'prod-1',
      quantity: 2,
      unit_price: 50,
      product: { name: 'Clavier', tva_rate: 19 },
    },
  ],
};

describe('invoiceReadiness', () => {
  describe('computeInvoiceReadiness', () => {
    it('devrait être prêt quand toutes les informations sont présentes', () => {
      const result = computeInvoiceReadiness({
        movement: movementWithItems,
        company: fullCompany,
        client: fullClient,
      });

      expect(result.is_ready).toBe(true);
      expect(result.is_complete).toBe(true);
      expect(result.missing_count).toBe(0);
      expect(result.missing_fields).toEqual([]);
    });

    it('devrait signaler le client manquant comme bloquant', () => {
      const result = computeInvoiceReadiness({
        movement: movementWithItems,
        company: fullCompany,
        client: null,
      });

      expect(result.is_ready).toBe(false);
      expect(result.is_complete).toBe(false);
      expect(result.missing_fields).toContainEqual(
        expect.objectContaining({ scope: 'client', field: 'clientId', required: true })
      );
    });

    it('devrait distinguer les champs bloquants des champs recommandés', () => {
      const result = computeInvoiceReadiness({
        movement: movementWithItems,
        company: fullCompany,
        client: { ...fullClient, address: '', codeTva: null },
      });

      expect(result.is_ready).toBe(true);
      expect(result.is_complete).toBe(false);
      expect(result.blocking_fields).toEqual([]);
      expect(result.missing_fields).toHaveLength(2);
      expect(result.missing_fields.map((field) => field.field)).toEqual(
        expect.arrayContaining(['address', 'codeTva'])
      );
    });

    it('devrait considers le matricule fiscal de l’entreprise comme bloquant', () => {
      const result = computeInvoiceReadiness({
        movement: movementWithItems,
        company: { ...fullCompany, matriculeFiscale: '' },
        client: fullClient,
      });

      expect(result.is_ready).toBe(false);
      expect(result.blocking_fields).toContainEqual(
        expect.objectContaining({ scope: 'company', field: 'matriculeFiscale' })
      );
    });

    it('devrait ignorer les champs remplis uniquement par des espaces', () => {
      const result = computeInvoiceReadiness({
        movement: movementWithItems,
        company: { ...fullCompany, address: '   ' },
        client: fullClient,
      });

      expect(result.is_complete).toBe(false);
      expect(result.missing_fields).toContainEqual(
        expect.objectContaining({ scope: 'company', field: 'address' })
      );
    });

    it('devrait bloquer un mouvement sans ligne à facturer', () => {
      const result = computeInvoiceReadiness({
        movement: { id: 'mvt-2', items: [] },
        company: fullCompany,
        client: fullClient,
      });

      expect(result.is_ready).toBe(false);
      expect(result.missing_fields).toContainEqual(
        expect.objectContaining({ scope: 'items', field: 'items', required: true })
      );
    });

    it('devrait signaler une quantité ou un prix unitaire incohérent avec le produit', () => {
      const result = computeInvoiceReadiness({
        movement: {
          id: 'mvt-3',
          items: [
            {
              id: 'item-1',
              productId: 'prod-1',
              quantity: 0,
              unit_price: null,
              product: { name: 'Souris', tva_rate: null },
            },
          ],
        },
        company: fullCompany,
        client: fullClient,
      });

      expect(result.is_ready).toBe(false);
      expect(result.missing_fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'quantity', productName: 'Souris' }),
          expect.objectContaining({ field: 'unit_price', productName: 'Souris' }),
          expect.objectContaining({ field: 'tva_rate', required: false }),
        ])
      );
    });
  });

  describe('getCompanyMissingFields', () => {
    it('devrait retourner une liste vide pour une entreprise complète', () => {
      expect(getCompanyMissingFields(fullCompany)).toEqual([]);
    });

    it('devrait lister les champs manquants de l’entreprise', () => {
      expect(getCompanyMissingFields(null)).toEqual([
        expect.objectContaining({ scope: 'company', field: 'matriculeFiscale', required: true }),
        expect.objectContaining({ scope: 'company', field: 'address', required: false }),
        expect.objectContaining({ scope: 'company', field: 'phone', required: false }),
      ]);
    });
  });
});