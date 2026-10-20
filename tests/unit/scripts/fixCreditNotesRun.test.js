jest.mock('../../../config/db', () => require('../helpers/prismaMock')());
const prisma = require('../../../config/db');
const { run } = require('../../../scripts/fix-credit-notes');

const original = {
  id: 'i1',
  reference: 'FAC-2026-0001',
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
// Ancien calcul : timbre inclus, retenue ignorée
const legacyCreditNote = {
  id: 'cn1',
  reference: 'AVO-2026-0001',
  original_invoice_id: 'i1',
  total_ht: -1000,
  tva_amount: -190,
  timbre_fiscal: 0,
  total_ttc: -1191,
  apply_rs: false,
  rs_rate: 1,
  rs_amount: 0,
  net_payable: -1191,
};
const orphanCreditNote = { id: 'cn2', reference: 'AVO-2026-0002', original_invoice_id: 'gone' };

describe('fix-credit-notes run', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    prisma.invoice.findMany.mockImplementation(async ({ where }) => {
      if (where.invoice_type === 'SALE') {
        return [
          { id: 's1', reference: 'FAC-2026-0002', apply_rs: true, rs_rate: 2.5 },
          { id: 's2', reference: 'FAC-2026-0003', apply_rs: true, rs_rate: 1 },
        ];
      }
      if (where.invoice_type === 'CREDIT_NOTE') return [legacyCreditNote, orphanCreditNote];
      return [original];
    });
    prisma.invoice.update.mockImplementation((query) => query);
  });

  it("simule sans écrire et ignore les avoirs sans facture d'origine", async () => {
    await run();

    expect(prisma.invoice.findMany.mock.calls[2][0].where).toEqual({ id: { in: ['i1', 'gone'] } });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('AVO-2026-0002'));
    expect(console.log).toHaveBeenCalledWith('[dry-run] FAC-2026-0002', { rs_rate: 1 });
    expect(console.log).toHaveBeenCalledWith(
      '[dry-run] AVO-2026-0001',
      expect.objectContaining({ total_ttc: -1190, apply_rs: true, rs_amount: -11.91 })
    );
    expect(console.log).toHaveBeenLastCalledWith('2 facture(s) à corriger — relancer avec --apply');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('applique toutes les corrections dans une seule transaction', async () => {
    await run({ apply: true });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0][0]).toEqual([
      { where: { id: 's1' }, data: { rs_rate: 1 } },
      { where: { id: 'cn1' }, data: expect.objectContaining({ net_payable: -1178.09 }) },
    ]);
    expect(console.log).toHaveBeenLastCalledWith('2 facture(s) corrigée(s)');
  });

  it("n'ouvre pas de transaction quand tout est déjà juste", async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    await run({ apply: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenLastCalledWith('0 facture(s) corrigée(s)');
  });
});
