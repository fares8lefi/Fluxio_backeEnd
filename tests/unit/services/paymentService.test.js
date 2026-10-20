const prisma = require('../../../config/db');
const paymentService = require('../../../src/services/paymentService');

jest.mock('../../../config/db', () => {
  const tx = {
    invoice: { findFirst: jest.fn(), update: jest.fn() },
    payment: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
  };
  return { ...tx, $transaction: jest.fn((fn) => fn(tx)) };
});

const invoice = (extra = {}) => ({
  id: 'i1',
  reference: 'FAC-2026-0003',
  invoice_type: 'SALE',
  status: 'PENDING',
  total_ttc: 1000,
  net_payable: 990, // retenue à la source 1 %
  amount_paid: 0,
  ...extra,
});

/** La facture chargée ; la recherche d'un avoir sur cette facture renvoie `creditNote` */
const mockInvoice = (inv, creditNote = null) =>
  prisma.invoice.findFirst.mockImplementation(async ({ where }) =>
    where.invoice_type === 'CREDIT_NOTE' ? creditNote : inv
  );

describe('paymentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.invoice.update.mockImplementation(async ({ data }) => ({ ...invoice(), ...data }));
  });

  it('un règlement partiel passe la facture en PARTIALLY_PAID', async () => {
    mockInvoice(invoice());
    const res = await paymentService.addPayment('i1', 'c1', { amount: 400, method: 'cash' });
    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 400,
        method: 'CASH',
        invoiceId: 'i1',
        companyId: 'c1',
      }),
    });
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'i1' },
      data: { amount_paid: 400, status: 'PARTIALLY_PAID' },
    });
    expect(res.invoice.remaining).toBe(590);
  });

  it('le dernier règlement solde la facture (net à payer, retenue déduite)', async () => {
    mockInvoice(invoice({ amount_paid: 400, status: 'PARTIALLY_PAID' }));
    await paymentService.addPayment('i1', 'c1', { amount: 590, method: 'TRANSFER' });
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'i1' },
      data: { amount_paid: 990, status: 'PAID' },
    });
  });

  it('refuse un règlement sur une facture créditée par un avoir', async () => {
    mockInvoice(invoice(), { reference: 'AVO-2026-0001' });
    await expect(
      paymentService.addPayment('i1', 'c1', { amount: 100, method: 'CASH' })
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringMatching(/AVO-2026-0001/) });
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('refuse un montant supérieur au reste à payer', async () => {
    mockInvoice(invoice({ amount_paid: 900 }));
    await expect(
      paymentService.addPayment('i1', 'c1', { amount: 100, method: 'CASH' })
    ).rejects.toMatchObject({
      statusCode: 400,
      details: { amount: 'Maximum : 90.000 TND' },
    });
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('exige le numéro pour un chèque ou une traite', async () => {
    await expect(
      paymentService.addPayment('i1', 'c1', { amount: 100, method: 'CHECK' })
    ).rejects.toMatchObject({
      details: { reference: 'Le numéro du chèque est obligatoire' },
    });
    await expect(
      paymentService.addPayment('i1', 'c1', {
        amount: 100,
        method: 'BILL_OF_EXCHANGE',
        reference: ' ',
      })
    ).rejects.toMatchObject({
      details: { reference: 'Le numéro de la traite est obligatoire' },
    });
  });

  it('refuse les règlements sur une facture annulée ou un avoir', async () => {
    prisma.invoice.findFirst.mockResolvedValueOnce(invoice({ status: 'CANCELLED' }));
    await expect(
      paymentService.addPayment('i1', 'c1', { amount: 10, method: 'CASH' })
    ).rejects.toThrow(/annulée/);
    prisma.invoice.findFirst.mockResolvedValueOnce(invoice({ invoice_type: 'CREDIT_NOTE' }));
    await expect(
      paymentService.addPayment('i1', 'c1', { amount: 10, method: 'CASH' })
    ).rejects.toThrow(/factures de vente/);
  });

  it("la suppression d'un règlement recalcule le statut", async () => {
    prisma.payment.findFirst.mockResolvedValue({ id: 'p2', amount: 590, invoiceId: 'i1' });
    mockInvoice(invoice({ amount_paid: 990, status: 'PAID' }));
    await paymentService.deletePayment('p2', 'c1');
    expect(prisma.payment.delete).toHaveBeenCalledWith({ where: { id: 'p2' } });
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'i1' },
      data: { amount_paid: 400, status: 'PARTIALLY_PAID' },
    });
  });
});
