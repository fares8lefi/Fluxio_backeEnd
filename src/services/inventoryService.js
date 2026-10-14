const prisma = require('../../config/db');
const mouvmentRepository = require('../repositories/mouvmentRepository');

const REASONS = ['INVENTORY', 'BREAKAGE', 'LOSS', 'EXPIRED', 'OTHER'];

const REASON_LABELS = {
  INVENTORY: 'Inventaire physique',
  BREAKAGE: 'Casse',
  LOSS: 'Perte / vol',
  EXPIRED: 'Péremption',
  OTHER: 'Autre',
};

const httpError = (message, statusCode, details) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (details) err.details = details;
  return err;
};

/**
 * Applique un inventaire (ou une correction ponctuelle) :
 * pour chaque produit compté, le stock prend la quantité comptée et l'écart
 * devient une ligne d'ajustement signée (+ excédent / − manquant), valorisée
 * au prix d'achat. Les ajustements sont exclus des ventes et des achats.
 *
 * @param {{ id, companyId }} user
 * @param {{ reason, note?, counts: { productId, counted }[] }} data
 * @returns {{ movement: object|null, adjusted: number, unchanged: number, value: number }}
 */
const applyAdjustment = async (user, data = {}) => {
  const reason = String(data.reason || '').toUpperCase();
  const counts = Array.isArray(data.counts) ? data.counts : [];
  const note = typeof data.note === 'string' ? data.note.trim() : '';

  const errors = {};
  if (!REASONS.includes(reason)) errors.reason = "Motif d'ajustement invalide";
  if (counts.length === 0) errors.counts = 'Aucune quantité comptée';
  counts.forEach((c, i) => {
    if (!c?.productId) errors[`counts.${i}`] = 'Produit manquant';
    else if (!Number.isInteger(Number(c.counted)) || Number(c.counted) < 0)
      errors[`counts.${i}`] = 'La quantité comptée doit être un entier positif ou nul';
  });
  if (reason === 'OTHER' && !note) errors.note = 'Précisez le motif';
  if (new Set(counts.map((c) => c.productId)).size !== counts.length)
    errors.counts = 'Produit compté deux fois';
  if (Object.keys(errors).length > 0) throw httpError('Ajustement invalide', 400, errors);

  return prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: { companyId: user.companyId, id: { in: counts.map((c) => c.productId) } },
      select: { id: true, name: true, stock_quantity: true, purchase_price: true, tva_rate: true },
    });
    if (products.length !== counts.length)
      throw httpError('Produit introuvable dans votre catalogue', 404);
    const byId = new Map(products.map((p) => [p.id, p]));

    const items = [];
    for (const { productId, counted } of counts) {
      const product = byId.get(productId);
      const diff = Number(counted) - product.stock_quantity;
      if (diff === 0) continue;
      await tx.product.update({
        where: { id: productId },
        data: { stock_quantity: Number(counted) },
      });
      items.push({
        productId,
        quantity: diff,
        unit_price: product.purchase_price,
        tva_rate: product.tva_rate,
        purchase_price: product.purchase_price,
      });
    }

    if (items.length === 0) {
      return { movement: null, adjusted: 0, unchanged: counts.length, value: 0 };
    }

    const movement = await mouvmentRepository.create(
      {
        type: 'ADJUSTMENT',
        adjustment_reason: reason,
        note: note || REASON_LABELS[reason],
        status: 'CONFIRMED',
        items,
        createdById: user.id,
        companyId: user.companyId,
      },
      tx
    );

    return {
      movement,
      adjusted: items.length,
      unchanged: counts.length - items.length,
      value: Math.round(items.reduce((s, it) => s + it.quantity * it.unit_price, 0) * 1000) / 1000,
    };
  });
};

module.exports = { applyAdjustment, REASONS, REASON_LABELS };
