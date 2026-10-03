/**
 * Contrôle de complétude des informations nécessaires à la génération d'une facture
 * (norme de facturation tunisienne). Retourne la liste des informations manquantes
 * afin que le frontend affiche un formulaire de complétion avant génération.
 */

const COMPANY_FIELDS = [
  { field: 'matriculeFiscale', label: "Matricule fiscal de l'entreprise", required: true },
  { field: 'address', label: "Adresse de l'entreprise", required: false },
  { field: 'phone', label: "Téléphone de l'entreprise", required: false },
];

const CLIENT_FIELDS = [
  { field: 'name', label: 'Nom du client', required: true },
  { field: 'matriculeFiscale', label: 'Matricule fiscal du client', required: true },
  { field: 'address', label: 'Adresse du client', required: false },
  { field: 'codeTva', label: 'Code TVA du client', required: false },
  { field: 'phone', label: 'Téléphone du client', required: false },
];

const isBlank = (value) =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

/**
 * Transforme un champ manquant en entrée exploitable par un formulaire
 */
const toMissingEntry = (scope, definition, extra = {}) => ({
  scope,
  field: definition.field,
  label: definition.label,
  required: definition.required === true,
  message: definition.required
    ? `${definition.label} est obligatoire pour éditer la facture`
    : `${definition.label} est manquante`,
  ...extra,
});

const collectEntityMissing = (scope, entity, definitions) =>
  definitions
    .filter((definition) => isBlank(entity?.[definition.field]))
    .map((definition) => toMissingEntry(scope, definition));

/**
 * Contrôle les lignes de vente (quantité, prix unitaire, taux de TVA)
 */
const collectItemsMissing = (items = []) => {
  const missing = [];

  if (items.length === 0) {
    missing.push({
      scope: 'items',
      field: 'items',
      label: 'Lignes de la vente',
      required: true,
      message: 'Le mouvement ne contient aucune ligne à facturer',
    });
    return missing;
  }

  items.forEach((item) => {
    const productName = item.product?.name || item.productId || 'produit inconnu';
    const context = { productId: item.productId, productName, lineId: item.id };

    if (!Number(item.quantity) || Number(item.quantity) <= 0) {
      missing.push(
        toMissingEntry(
          'items',
          { field: 'quantity', label: `Quantité vendue pour « ${productName} »`, required: true },
          context
        )
      );
    }

    if (item.unit_price === null || item.unit_price === undefined || Number(item.unit_price) < 0) {
      missing.push(
        toMissingEntry(
          'items',
          { field: 'unit_price', label: `Prix unitaire HT de « ${productName} »`, required: true },
          context
        )
      );
    }

    if (item.product && isBlank(item.product.tva_rate)) {
      missing.push(
        toMissingEntry(
          'items',
          { field: 'tva_rate', label: `Taux de TVA de « ${productName} »`, required: false },
          context
        )
      );
    }
  });

  return missing;
};

/**
 * Calcule l'état de complétude d'une facture à générer depuis un mouvement OUT
 * @param {object} params - { movement, company, client }
 * @returns {{is_ready: boolean, is_complete: boolean, missing_count: number,
 *            missing_fields: Array, blocking_fields: Array}}
 */
const computeInvoiceReadiness = ({ movement, company, client } = {}) => {
  const missingFields = [
    ...collectEntityMissing('company', company, COMPANY_FIELDS),
    ...(client
      ? collectEntityMissing('client', client, CLIENT_FIELDS)
      : [
          toMissingEntry('client', { field: 'clientId', label: 'Client de la vente', required: true }, {
            message: 'Aucun client rattaché au mouvement de vente',
          }),
        ]),
    ...collectItemsMissing(movement?.items || []),
  ];

  const blockingFields = missingFields.filter((entry) => entry.required);

  return {
    is_ready: blockingFields.length === 0,
    is_complete: missingFields.length === 0,
    missing_count: missingFields.length,
    missing_fields: missingFields,
    blocking_fields: blockingFields,
  };
};

/**
 * Champs manquants de l'entreprise émettrice
 */
const getCompanyMissingFields = (company) =>
  collectEntityMissing('company', company, COMPANY_FIELDS);

/**
 * Champs manquants du client de la facture
 */
const getClientMissingFields = (client) => collectEntityMissing('client', client, CLIENT_FIELDS);

module.exports = {
  computeInvoiceReadiness,
  getCompanyMissingFields,
  getClientMissingFields,
  COMPANY_FIELDS,
  CLIENT_FIELDS,
};