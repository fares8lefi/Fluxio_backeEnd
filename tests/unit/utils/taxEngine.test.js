const {
  calculateTotals,
  amountToWords,
  generateReference,
  TIMBRE_FISCAL,
} = require('../../../src/utils/taxEngine');

describe('Tunisian taxEngine Unit Tests', () => {
  describe('calculateTotals', () => {
    it('should calculate standard VAT 19% with 1.000 DT timbre fiscal', () => {
      const items = [
        { unit_price: 100, quantity: 2, tva_rate: 19 }, // 200 HT -> 38 TVA
      ];
      const result = calculateTotals(items);

      expect(result.total_ht).toBe(200);
      expect(result.tva_amount).toBe(38);
      expect(result.timbre_fiscal).toBe(1.0);
      expect(result.total_ttc).toBe(239);
      expect(result.net_payable).toBe(239);
      expect(result.tva_breakdown).toEqual([
        { rate: 19, base_ht: 200, tva_amount: 38 },
      ]);
    });

    it('should calculate multiple VAT tranches (7%, 19%) correctly', () => {
      const items = [
        { unit_price: 100, quantity: 1, tva_rate: 7 },  // 100 HT -> 7 TVA
        { unit_price: 200, quantity: 1, tva_rate: 19 }, // 200 HT -> 38 TVA
      ];
      const result = calculateTotals(items);

      expect(result.total_ht).toBe(300);
      expect(result.tva_amount).toBe(45);
      expect(result.timbre_fiscal).toBe(1.0);
      expect(result.total_ttc).toBe(346);
      expect(result.tva_breakdown.length).toBe(2);
    });

    it('should handle suspension of TVA regime (is_suspended: true)', () => {
      const items = [
        { unit_price: 1000, quantity: 1, tva_rate: 19 },
      ];
      const result = calculateTotals(items, { is_suspended: true });

      expect(result.total_ht).toBe(1000);
      expect(result.tva_amount).toBe(0);
      expect(result.timbre_fiscal).toBe(0); // Exempt under suspension
      expect(result.total_ttc).toBe(1000);
      expect(result.net_payable).toBe(1000);
      expect(result.rs_amount).toBe(0);
    });

    it('should apply Retenue à la Source (1% on goods >= 1000 DT TTC)', () => {
      const items = [
        { unit_price: 1000, quantity: 1, tva_rate: 19 }, // 1000 HT + 190 TVA + 1 Timbre = 1191 TTC
      ];
      const result = calculateTotals(items, { apply_rs: true, rs_rate: 1.0 });

      expect(result.total_ttc).toBe(1191);
      expect(result.rs_amount).toBe(11.91); // 1% of 1191
      expect(result.net_payable).toBe(1179.09); // 1191 - 11.91
    });

    it('should apply Retenue à la Source for services (5%)', () => {
      const items = [
        { unit_price: 500, quantity: 1, tva_rate: 19 }, // 500 HT + 95 TVA + 1 Timbre = 596 TTC
      ];
      const result = calculateTotals(items, { apply_rs: true, rs_rate: 5.0 });

      expect(result.total_ttc).toBe(596);
      expect(result.rs_amount).toBe(29.8); // 5% of 596
      expect(result.net_payable).toBe(566.2);
    });
  });

  describe('amountToWords', () => {
    it('should convert 0 to "Zéro dinar"', () => {
      expect(amountToWords(0)).toBe('Zéro dinar');
    });

    it('should convert integers correctly (e.g. 150)', () => {
      const words = amountToWords(150);
      expect(words.toLowerCase()).toContain('cent cinquante dinars');
    });

    it('should convert millimes correctly (e.g. 1.500 DT)', () => {
      const words = amountToWords(1.500);
      expect(words.toLowerCase()).toContain('un dinar');
      expect(words.toLowerCase()).toContain('cinq cents millimes');
    });

    it('should convert large numbers with millimes (e.g. 1250.750 DT)', () => {
      const words = amountToWords(1250.750);
      expect(words.toLowerCase()).toContain('mille');
      expect(words.toLowerCase()).toContain('dinars');
      expect(words.toLowerCase()).toContain('millimes');
    });
  });

  describe('generateReference', () => {
    it('should format sequential reference correctly', () => {
      const year = new Date().getFullYear();
      expect(generateReference('FAC', 1)).toBe(`FAC-${year}-0001`);
      expect(generateReference('DEV', 42)).toBe(`DEV-${year}-0042`);
      expect(generateReference('AVO', 105)).toBe(`AVO-${year}-0105`);
    });
  });
});
