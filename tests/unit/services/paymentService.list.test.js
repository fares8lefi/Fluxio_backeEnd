const prisma = require('../../../config/db');
const paymentService = require('../../../src/services/paymentService');

jest.mock('../../../config/db', () => ({
  invoice: { findFirst: jest.fn() },
  payment: { findMany: jest.fn() },
}));

describe('paymentService.listPayments', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renvoie les règlements et le reste à payer', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'i1',
      reference: 'FAC-2026-0003',
      status: 'PARTIALLY_PAID',
      total_ttc: 1000,
      net_payable: 990,
      amount_paid: 400,
    });
    const payments = [{ id: 'p1', amount: 400 }];
    prisma.payment.findMany.mockResolvedValue(payments);

    await expect(paymentService.listPayments('i1', 'c1')).resolves.toEqual({
      invoice: {
        id: 'i1',
        reference: 'FAC-2026-0003',
        status: 'PARTIALLY_PAID',
        amount_due: 990,
        amount_paid: 400,
        remaining: 590,
      },
      payments,
    });
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith({ where: { id: 'i1', companyId: 'c1' } });
    expect(prisma.payment.findMany).toHaveBeenCalledWith({
      where: { invoiceId: 'i1' },
      orderBy: { date: 'asc' },
    });
  });

  it("renvoie 404 pour une facture d'une autre entreprise", async () => {
    prisma.invoice.findFirst.mockResolvedValue(null);
    await expect(paymentService.listPayments('i1', 'c2')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });
});
