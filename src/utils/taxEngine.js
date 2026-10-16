/**
 * Moteur de calcul fiscal tunisien
 * Taux TVA légaux : 0%, 7%, 13%, 19%
 * Timbre fiscal : 1.000 TND
 * Retenue à la source : 1% (marchandises ≥1000 DT), 5%, 15% (services/honoraires)
 */

const TIMBRE_FISCAL = 1.0;
const VALID_TVA_RATES = [0, 7, 13, 19];
const VALID_RS_RATES = [1.0, 5.0, 15.0];

const taxError = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

/**
 * Taux de TVA d'une ligne : absent → 19 % (taux normal), hors barème → erreur.
 * Un taux inconnu n'est jamais remplacé en silence : le document afficherait
 * un taux et en calculerait un autre.
 */
const resolveTvaRate = (value, label = 'une ligne') => {
  if (value === null || value === undefined || value === '') return 19;
  const rate = Number(value);
  if (!VALID_TVA_RATES.includes(rate)) {
    throw taxError(
      `Taux de TVA invalide (${value} %) pour ${label} : taux autorisés ${VALID_TVA_RATES.join(', ')} %`
    );
  }
  return rate;
};

/** Taux de retenue à la source : doit appartenir au barème */
const resolveRsRate = (value) => {
  const rate = Number(value);
  if (!VALID_RS_RATES.includes(rate)) {
    throw taxError(
      `Taux de retenue à la source invalide (${value} %) : taux autorisés ${VALID_RS_RATES.join(', ')} %`
    );
  }
  return rate;
};

/**
 * Calcule les montants fiscaux à partir des items
 * @param {Array} items - [{unit_price, quantity, tva_rate, name?}]
 * @param {object} options - {is_suspended, apply_rs, rs_rate}
 * @returns {object} {total_ht, tva_breakdown, tva_amount, timbre_fiscal, total_ttc,
 *                    apply_rs, rs_rate, rs_amount, net_payable}
 * @throws {Error} statusCode 400 si un taux de TVA ou de RS est hors barème
 */
const calculateTotals = (items = [], options = {}) => {
  const { is_suspended = false, apply_rs = false, rs_rate = 1.0 } = options;
  // Pas de retenue sur une vente en suspension : le flag stocké suit le calcul
  const rsApplied = Boolean(apply_rs) && !is_suspended;
  const rsRate = rsApplied ? resolveRsRate(rs_rate) : Number(rs_rate) || 1.0;

  const tvaGroups = {};
  let total_ht = 0;

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    const rate = resolveTvaRate(item.tva_rate, item.name ? `« ${item.name} »` : undefined);
    // Remise ligne en % (devis) — bornée à [0, 100]
    const discount = Math.min(Math.max(Number(item.discount) || 0, 0), 100);
    const lineHT = parseFloat((price * qty * (1 - discount / 100)).toFixed(3));
    total_ht += lineHT;

    if (!tvaGroups[rate]) {
      tvaGroups[rate] = { rate, base_ht: 0, tva_amount: 0 };
    }
    tvaGroups[rate].base_ht += lineHT;
  }

  total_ht = parseFloat(total_ht.toFixed(3));

  let tva_amount = 0;
  const tva_breakdown = [];

  for (const rateKey of Object.keys(tvaGroups).sort((a, b) => Number(a) - Number(b))) {
    const group = tvaGroups[rateKey];
    group.base_ht = parseFloat(group.base_ht.toFixed(3));
    group.tva_amount = is_suspended
      ? 0
      : parseFloat(((group.base_ht * group.rate) / 100).toFixed(3));
    tva_amount += group.tva_amount;
    tva_breakdown.push(group);
  }

  tva_amount = parseFloat(tva_amount.toFixed(3));

  const timbre_fiscal = is_suspended ? 0 : TIMBRE_FISCAL;
  const total_ttc = parseFloat((total_ht + tva_amount + timbre_fiscal).toFixed(3));

  const rs_amount = rsApplied ? parseFloat(((total_ttc * rsRate) / 100).toFixed(3)) : 0;
  const net_payable = parseFloat((total_ttc - rs_amount).toFixed(3));

  return {
    total_ht,
    tva_breakdown,
    tva_amount,
    timbre_fiscal,
    total_ttc,
    apply_rs: rsApplied,
    rs_rate: rsRate,
    rs_amount,
    net_payable,
  };
};

/**
 * Montants d'une facture d'avoir totale. L'avoir rembourse HT et TVA mais pas
 * le timbre (non restituable) ; la retenue de la facture d'origine est annulée
 * en sens inverse. Invariants respectés : TTC = HT + TVA + timbre, net = TTC − RS.
 */
const creditNoteTotals = (original) => {
  const round = (n) => parseFloat(n.toFixed(3));
  const total_ht = -Math.abs(original.total_ht || 0);
  const tva_amount = -Math.abs(original.tva_amount || 0);
  const total_ttc = round(total_ht + tva_amount);
  // Anciennes factures : flag RS resté actif en suspension, ou taux hors barème
  // enregistré alors que le calcul appliquait 1 %
  const rsApplied = Boolean(original.apply_rs) && !original.is_suspended && Math.abs(original.rs_amount || 0) > 0;
  const rs_amount = rsApplied ? -Math.abs(original.rs_amount) : 0;
  return {
    total_ht,
    tva_amount,
    timbre_fiscal: 0,
    total_ttc,
    apply_rs: rsApplied,
    rs_rate: VALID_RS_RATES.includes(Number(original.rs_rate)) ? Number(original.rs_rate) : 1.0,
    rs_amount,
    net_payable: round(total_ttc - rs_amount),
  };
};

const ONES = [
  'zéro',
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize',
  'dix-sept',
  'dix-huit',
  'dix-neuf',
];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

/**
 * 0–99 en lettres
 * @param {boolean} final — rien ne suit (« quatre-vingts » prend alors un s)
 */
const below100 = (n, final) => {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  if (t <= 6) {
    if (o === 0) return TENS[t];
    return TENS[t] + (o === 1 ? ' et un' : '-' + ONES[o]);
  }
  if (t === 7) return 'soixante' + (o === 1 ? ' et onze' : '-' + ONES[10 + o]);
  // 80–99 : « quatre-vingt-un », jamais « et un »
  if (n === 80) return final ? 'quatre-vingts' : 'quatre-vingt';
  return 'quatre-vingt-' + ONES[n - 80];
};

/** 0–999 en lettres (« deux cents » mais « deux cent trois ») */
const below1000 = (n, final) => {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts = [];
  if (h === 1) parts.push('cent');
  else if (h > 1) parts.push(ONES[h] + ' cent' + (rest === 0 && final ? 's' : ''));
  if (rest > 0) parts.push(below100(rest, final));
  return parts.join(' ');
};

/** Entier positif en lettres, jusqu'aux milliards */
const integerToWords = (n) => {
  if (n === 0) return 'zéro';
  const parts = [];
  const scales = [
    [1e9, 'milliard'],
    [1e6, 'million'],
  ];
  for (const [size, noun] of scales) {
    const count = Math.floor(n / size);
    if (count > 0) {
      // milliard/million sont des noms : ils s'accordent, le nombre devant aussi
      parts.push(below1000(count, true) + ' ' + noun + (count > 1 ? 's' : ''));
      n %= size;
    }
  }
  const thousands = Math.floor(n / 1000);
  if (thousands > 0) {
    // « mille » est invariable et rend le nombre qui précède non final
    parts.push(thousands === 1 ? 'mille' : below1000(thousands, false) + ' mille');
    n %= 1000;
  }
  if (n > 0) parts.push(below1000(n, true));
  return parts.join(' ');
};

/**
 * Convertit un montant en toutes lettres (Dinars Tunisiens et millimes)
 * ex : 1250.75 → « Mille deux cent cinquante dinars et sept cent cinquante millimes »
 * @param {number} amount
 * @returns {string}
 */
const amountToWords = (amount) => {
  const rounded = Math.round(Math.abs(amount || 0) * 1000);
  const dinars = Math.floor(rounded / 1000);
  const millimes = rounded % 1000;

  if (dinars === 0 && millimes === 0) return 'Zéro dinar';

  const parts = [];
  if (dinars > 0) {
    // « un million de dinars », « deux millions de dinars »
    const roundScale = dinars >= 1e6 && dinars % 1e6 === 0;
    parts.push(
      integerToWords(dinars) + (roundScale ? ' de' : '') + (dinars > 1 ? ' dinars' : ' dinar')
    );
  }
  if (millimes > 0) {
    parts.push(integerToWords(millimes) + (millimes > 1 ? ' millimes' : ' millime'));
  }

  let result = parts.join(' et ');
  if (amount < 0) result = 'moins ' + result;
  return result.charAt(0).toUpperCase() + result.slice(1);
};

/**
 * Génère une référence séquentielle
 * @param {string} prefix 'FAC' | 'DEV' | 'AVO'
 * @param {number} sequenceNumber
 * @returns {string} ex: FAC-2026-0001
 */
const generateReference = (prefix, sequenceNumber) => {
  const year = new Date().getFullYear();
  const seq = String(sequenceNumber).padStart(4, '0');
  return `${prefix}-${year}-${seq}`;
};

module.exports = {
  calculateTotals,
  creditNoteTotals,
  resolveTvaRate,
  amountToWords,
  generateReference,
  TIMBRE_FISCAL,
  VALID_TVA_RATES,
  VALID_RS_RATES,
};
