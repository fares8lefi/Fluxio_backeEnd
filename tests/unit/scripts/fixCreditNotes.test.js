jest.mock('../../../config/db', () => ({}));

const { planCreditNoteFix, planSaleRateFix } = require('../../../scripts/fix-credit-notes');

// Facture : 1000 HT + 190 TVA + 1 timbre = 1191 TTC ; RS 1 % = 11,91 ; net 1179,09
const original = {
  total_ht: 1000,
  tva_amount: 190,
  timbre_fiscal: 1,
  total_ttc: 1191,
  apply_rs: true,
  rs_rate: 1,
  rs_amount: 11.91,
  net_payable: 1179.09,
  is_suspended: false,
};

// Avoir tel que l'ancien createCreditNote l'enregistrait
const legacyCreditNote = {
  total_ht: -1000,
  tva_amount: -190,
  timbre_fiscal: 0,
  total_ttc: -1191,
  apply_rs: false,
  rs_rate: 1,
  rs_amount: 0,
  net_payable: -1179.09,
};

describe('fix-credit-notes', () => {
  it("corrige le TTC (sans timbre) et rétablit la retenue d'un ancien avoir", () => {
    expect(planCreditNoteFix(legacyCreditNote, original)).toEqual({
      total_ttc: -1190,
      apply_rs: true,
      rs_amount: -11.91,
      net_payable: -1178.09,
    });
  });

  it('ne touche pas un avoir déjà juste', () => {
    const fixed = {
      ...legacyCreditNote,
      total_ttc: -1190,
      apply_rs: true,
      rs_amount: -11.91,
      net_payable: -1178.09,
    };
    expect(planCreditNoteFix(fixed, original)).toBeNull();
  });

  it("n'active pas la RS si la facture d'origine était en suspension", () => {
    const suspended = {
      ...original,
      is_suspended: true,
      tva_amount: 0,
      timbre_fiscal: 0,
      total_ttc: 1000,
      rs_amount: 0,
      net_payable: 1000,
    };
    const cn = { ...legacyCreditNote, tva_amount: 0, total_ttc: -1000, net_payable: -1000 };
    expect(planCreditNoteFix(cn, suspended)).toBeNull();
  });

  it('ramène à 1 % un taux de RS hors barème sur une facture de vente', () => {
    expect(planSaleRateFix({ apply_rs: true, rs_rate: 3 })).toEqual({ rs_rate: 1 });
    expect(planSaleRateFix({ apply_rs: true, rs_rate: 5 })).toBeNull();
    expect(planSaleRateFix({ apply_rs: false, rs_rate: 3 })).toBeNull();
  });
});
