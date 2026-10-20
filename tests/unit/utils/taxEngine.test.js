const {
  calculateTotals,
  creditNoteTotals,
  amountToWords,
  generateReference,
} =require('../../../src/utils/taxEngine');

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
      expect(result.tva_breakdown).toEqual([{ rate: 19, base_ht: 200, tva_amount: 38 }]);
    });

    it('should calculate multiple VAT tranches (7%, 19%) correctly', () => {
      const items = [
        { unit_price: 100, quantity: 1, tva_rate: 7 }, // 100 HT -> 7 TVA
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
      const items = [{ unit_price: 1000, quantity: 1, tva_rate: 19 }];
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
      const words = amountToWords(1.5);
      expect(words.toLowerCase()).toContain('un dinar');
      expect(words.toLowerCase()).toContain('cinq cents millimes');
    });

    it('should convert large numbers with millimes (e.g. 1250.750 DT)', () => {
      const words = amountToWords(1250.75);
      expect(words.toLowerCase()).toContain('mille');
      expect(words.toLowerCase()).toContain('dinars');
      expect(words.toLowerCase()).toContain('millimes');
    });

    it.each([
      [21, 'Vingt et un dinars'],
      [71, 'Soixante et onze dinars'],
      [80, 'Quatre-vingts dinars'],
      [81, 'Quatre-vingt-un dinars'],
      [200, 'Deux cents dinars'],
      [203, 'Deux cent trois dinars'],
      [80000, 'Quatre-vingt mille dinars'],
      [200000, 'Deux cent mille dinars'],
      [1191, 'Mille cent quatre-vingt-onze dinars'],
      [2000000, 'Deux millions de dinars'],
      [0.001, 'Un millime'],
      [1250.75, 'Mille deux cent cinquante dinars et sept cent cinquante millimes'],
    ])("applique les règles d'accord françaises (%s)", (amount, expected) => {
      expect(amountToWords(amount)).toBe(expected);
    });
  });

  describe('calculateTotals — remise', () => {
    it('applique la remise ligne avant TVA', () => {
      const result = calculateTotals([
        { unit_price: 100, quantity: 2, tva_rate: 19, discount: 10 },
      ]);
      expect(result.total_ht).toBe(180);
      expect(result.tva_amount).toBe(34.2);
      expect(result.total_ttc).toBe(215.2);
    });
  });

  describe('calculateTotals — taux hors barème', () => {
    it('refuse un taux de TVA inconnu au lieu de le remplacer par 19 %', () => {
      expect(() =>
        calculateTotals([{ name: 'Vis', unit_price: 100, quantity: 1, tva_rate: 10 }])
      ).toThrow(/Taux de TVA invalide \(10 %\) pour « Vis »/);
    });

    it('applique 19 % quand le taux est absent', () => {
      const result = calculateTotals([{ unit_price: 100, quantity: 1 }]);
      expect(result.tva_breakdown).toEqual([{ rate: 19, base_ht: 100, tva_amount: 19 }]);
    });

    it('refuse un taux de RS inconnu au lieu de calculer à 1 %', () => {
      const items = [{ unit_price: 1000, quantity: 1, tva_rate: 19 }];
      expect(() => calculateTotals(items, { apply_rs: true, rs_rate: 3 })).toThrow(
        expect.objectContaining({ statusCode: 400 })
      );
    });

    it("renvoie le taux de RS réellement appliqué", () => {
      const items = [{ unit_price: 1000, quantity: 1, tva_rate: 19 }];
      const result = calculateTotals(items, { apply_rs: true, rs_rate: '5' });
      expect(result).toMatchObject({ apply_rs: true, rs_rate: 5, rs_amount: 59.55 });
    });

    it("n'active pas la RS sur une vente en suspension, même si elle est demandée", () => {
      const items = [{ unit_price: 1000, quantity: 1, tva_rate: 19 }];
      const result = calculateTotals(items, { is_suspended: true, apply_rs: true, rs_rate: 1 });
      expect(result).toMatchObject({ apply_rs: false, rs_amount: 0, net_payable: 1000 });
    });
  });

  describe('creditNoteTotals', () => {
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
    };

    it('rembourse HT et TVA, sans le timbre', () => {
      const cn = creditNoteTotals(original);
      expect(cn).toMatchObject({ total_ht: -1000, tva_amount: -190, timbre_fiscal: 0, total_ttc: -1190 });
    });

    it('annule la retenue en sens inverse : net = TTC − RS', () => {
      const cn = creditNoteTotals(original);
      expect(cn).toMatchObject({ apply_rs: true, rs_rate: 1, rs_amount: -11.91, net_payable: -1178.09 });
      expect(cn.net_payable).toBeCloseTo(cn.total_ttc - cn.rs_amount, 3);
    });

    it('sans RS sur la facture, net = TTC', () => {
      const cn = creditNoteTotals({ ...original, apply_rs: false, rs_amount: 0, net_payable: 1191 });
      expect(cn).toMatchObject({ apply_rs: false, rs_amount: 0, net_payable: -1190 });
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
