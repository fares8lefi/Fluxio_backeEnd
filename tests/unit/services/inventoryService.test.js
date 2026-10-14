const prisma = require('../../../config/db');
const inventoryService = require('../../../src/services/inventoryService');

jest.mock('../../../config/db', () => {
  const tx = { product: { findMany: jest.fn(), update: jest.fn() } };
  return { ...tx, $transaction: jest.fn((fn) => fn(tx)) };
});
jest.mock('../../../src/repositories/mouvmentRepository', () => ({
  create: jest.fn(async (data) => ({ id: 'm1', ...data })),
}));
const mouvmentRepository = require('../../../src/repositories/mouvmentRepository');

const user = { id: 'u1', companyId: 'c1' };
const products = [
  { id: 'p1', name: 'Ciment', stock_quantity: 120, purchase_price: 12, tva_rate: 19 },
  { id: 'p2', name: 'Fer', stock_quantity: 40, purchase_price: 25, tva_rate: 19 },
  { id: 'p3', name: 'Huile', stock_quantity: 6, purchase_price: 40, tva_rate: 7 },
];

describe('inventoryService.applyAdjustment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.product.findMany.mockResolvedValue(products);
  });

  it('remplace le stock par le comptage et crée des lignes signées valorisées', async () => {
    const res = await inventoryService.applyAdjustment(user, {
      reason: 'INVENTORY',
      counts: [
        { productId: 'p1', counted: 118 }, // −2
        { productId: 'p2', counted: 43 }, // +3
        { productId: 'p3', counted: 6 }, // inchangé
      ],
    });

    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { stock_quantity: 118 },
    });
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'p2' },
      data: { stock_quantity: 43 },
    });
    expect(prisma.product.update).toHaveBeenCalledTimes(2);
    expect(mouvmentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADJUSTMENT',
        adjustment_reason: 'INVENTORY',
        items: [
          expect.objectContaining({ productId: 'p1', quantity: -2, unit_price: 12 }),
          expect.objectContaining({ productId: 'p2', quantity: 3, unit_price: 25 }),
        ],
      }),
      expect.anything()
    );
    expect(res).toMatchObject({ adjusted: 2, unchanged: 1, value: 51 }); // −24 + 75
  });

  it('ne crée aucun mouvement si aucun écart', async () => {
    prisma.product.findMany.mockResolvedValue([products[2]]); // la base filtre par id
    const res = await inventoryService.applyAdjustment(user, {
      reason: 'INVENTORY',
      counts: [{ productId: 'p3', counted: 6 }],
    });
    expect(res).toMatchObject({ movement: null, adjusted: 0 });
    expect(mouvmentRepository.create).not.toHaveBeenCalled();
  });

  it('valide motif, quantités et doublons', async () => {
    await expect(
      inventoryService.applyAdjustment(user, {
        reason: 'NOPE',
        counts: [{ productId: 'p1', counted: -1 }],
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      details: { reason: expect.any(String), 'counts.0': expect.any(String) },
    });
    await expect(
      inventoryService.applyAdjustment(user, {
        reason: 'OTHER',
        counts: [{ productId: 'p1', counted: 1 }],
      })
    ).rejects.toMatchObject({
      details: { note: 'Précisez le motif' },
    });
    await expect(
      inventoryService.applyAdjustment(user, {
        reason: 'LOSS',
        counts: [
          { productId: 'p1', counted: 1 },
          { productId: 'p1', counted: 2 },
        ],
      })
    ).rejects.toMatchObject({ details: { counts: 'Produit compté deux fois' } });
  });

  it("refuse un produit d'une autre entreprise", async () => {
    prisma.product.findMany.mockResolvedValue([products[0]]);
    await expect(
      inventoryService.applyAdjustment(user, {
        reason: 'LOSS',
        counts: [
          { productId: 'p1', counted: 1 },
          { productId: 'pX', counted: 2 },
        ],
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
