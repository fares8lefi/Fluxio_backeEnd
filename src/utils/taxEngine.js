/**
 * Moteur de calcul fiscal tunisien
 * Taux TVA légaux : 0%, 7%, 13%, 19%
 * Timbre fiscal : 1.000 TND
 * Retenue à la source : 1% (marchandises ≥1000 DT), 5%, 15% (services/honoraires)
 */

const TIMBRE_FISCAL = 1.000;
const VALID_TVA_RATES = [0, 7, 13, 19];
const VALID_RS_RATES = [1.0, 5.0, 15.0];

/**
 * Calcule les montants fiscaux à partir des items
 * @param {Array} items - [{unit_price, quantity, tva_rate}]
 * @param {object} options - {is_suspended, apply_rs, rs_rate}
 * @returns {object} {total_ht, tva_breakdown, tva_amount, timbre_fiscal, total_ttc, rs_amount, net_payable}
 */
const calculateTotals = (items = [], options = {}) => {
  const { is_suspended = false, apply_rs = false, rs_rate = 1.0 } = options;

  const tvaGroups = {};
  let total_ht = 0;

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    const rate = VALID_TVA_RATES.includes(Number(item.tva_rate)) ? Number(item.tva_rate) : 19;
    const lineHT = parseFloat((price * qty).toFixed(3));
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

  let rs_amount = 0;
  if (apply_rs && !is_suspended) {
    const validRate = VALID_RS_RATES.includes(Number(rs_rate)) ? Number(rs_rate) : 1.0;
    rs_amount = parseFloat(((total_ttc * validRate) / 100).toFixed(3));
  }

  const net_payable = parseFloat((total_ttc - rs_amount).toFixed(3));

  return {
    total_ht,
    tva_breakdown,
    tva_amount,
    timbre_fiscal,
    total_ttc,
    rs_amount,
    net_payable,
  };
};

/**
 * Convertit un montant en toutes lettres (Dinars Tunisiens et millimes)
 * @param {number} amount
 * @returns {string}
 */
const amountToWords = (amount) => {
  const ones = [
    '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
    'dix-sept', 'dix-huit', 'dix-neuf'
  ];
  const tens = [
    '', 'dix', 'vingt', 'trente', 'quarante', 'cinquante',
    'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'
  ];

  const convertHundreds = (n) => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) {
      const t = Math.floor(n / 10);
      const o = n % 10;
      if (t === 7 || t === 9) {
        return tens[t - 1] + (o > 0 ? '-' + ones[10 + o] : '-dix');
      }
      if (t === 8) {
        return 'quatre-vingt' + (o > 0 ? '-' + ones[o] : 's');
      }
      return tens[t] + (o > 0 ? (o === 1 && t !== 8 ? ' et un' : '-' + ones[o]) : '');
    }
    const h = Math.floor(n / 100);
    const rem = n % 100;
    const hStr = h === 1 ? 'cent' : ones[h] + ' cents';
    return hStr + (rem > 0 ? ' ' + convertHundreds(rem) : '');
  };

  const convertBlock = (n) => {
    if (n === 0) return '';
    if (n < 1000) return convertHundreds(n);

    const thousands = Math.floor(n / 1000);
    const rem = n % 1000;
    const thouStr = thousands === 1 ? 'mille' : convertHundreds(thousands) + ' mille';
    return thouStr + (rem > 0 ? ' ' + convertHundreds(rem) : '');
  };

  const absAmount = Math.abs(amount || 0);
  const rounded = Math.round(absAmount * 1000);
  const dinars = Math.floor(rounded / 1000);
  const millimes = rounded % 1000;

  if (dinars === 0 && millimes === 0) return 'Zéro dinar';

  let result = '';
  if (dinars > 0) {
    result = convertBlock(dinars);
    result += dinars > 1 ? ' dinars' : ' dinar';
  }

  if (millimes > 0) {
    const millimesStr = convertHundreds(millimes);
    result += (dinars > 0 ? ' et ' : '') + millimesStr + ' millimes';
  }

  if (amount < 0) {
    result = 'Moins ' + result;
  }

  return result.charAt(0).toUpperCase() + result.slice(1).trim();
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
  amountToWords,
  generateReference,
  TIMBRE_FISCAL,
  VALID_TVA_RATES,
  VALID_RS_RATES,
};
