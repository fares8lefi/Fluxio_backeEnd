const prisma = require('../config/db');
const { creditNoteTotals, VALID_RS_RATES } = require('../src/utils/taxEngine');

/* ────────────────────────────────────────────────────────────────────────────
 * Correction ponctuelle des factures enregistrées avec l'ancien calcul
 *
 *  - Avoirs : l'ancien createCreditNote incluait le timbre dans le TTC et
 *    ignorait la retenue à la source de la facture d'origine.
 *  - Factures de vente : un taux de RS hors barème était stocké alors que le
 *    calcul appliquait 1 %.
 *
 *  Usage : node scripts/fix-credit-notes.js           → simulation (aucune écriture)
 *          node scripts/fix-credit-notes.js --apply   → applique les corrections
 * ──────────────────────────────────────────────────────────────────────────── */

const EPSILON = 0.0005; // montants au millime

const sameValue = (a, b) =>
  typeof a === 'number' || typeof b === 'number'
    ? Math.abs(Number(a ?? 0) - Number(b ?? 0)) < EPSILON
    : a === b;

/** Champs à corriger sur un avoir (null si déjà juste) */
const planCreditNoteFix = (creditNote, original) => {
  const expected = creditNoteTotals(original);
  const changes = {};
  for (const [field, value] of Object.entries(expected)) {
    if (!sameValue(creditNote[field], value)) changes[field] = value;
  }
  return Object.keys(changes).length ? changes : null;
};

/** Taux de RS à corriger sur une facture de vente (null si déjà juste) */
const planSaleRateFix = (invoice) =>
  invoice.apply_rs && !VALID_RS_RATES.includes(Number(invoice.rs_rate)) ? { rs_rate: 1.0 } : null;

const run = async ({ apply = false } = {}) => {
  const updates = [];

  const sales = await prisma.invoice.findMany({
    where: { invoice_type: 'SALE', apply_rs: true },
    select: { id: true, reference: true, apply_rs: true, rs_rate: true },
  });
  for (const sale of sales) {
    const changes = planSaleRateFix(sale);
    if (changes) updates.push({ id: sale.id, reference: sale.reference, changes });
  }

  const creditNotes = await prisma.invoice.findMany({
    where: { invoice_type: 'CREDIT_NOTE', original_invoice_id: { not: null } },
  });
  const originals = await prisma.invoice.findMany({
    where: { id: { in: [...new Set(creditNotes.map((cn) => cn.original_invoice_id))] } },
  });
  const originalsById = new Map(originals.map((inv) => [inv.id, inv]));

  for (const cn of creditNotes) {
    const original = originalsById.get(cn.original_invoice_id);
    if (!original) {
      console.warn(`[skip] ${cn.reference} : facture d'origine introuvable`);
      continue;
    }
    const changes = planCreditNoteFix(cn, original);
    if (changes) updates.push({ id: cn.id, reference: cn.reference, changes });
  }

  for (const { reference, changes } of updates) {
    console.log(`${apply ? '[fix]' : '[dry-run]'} ${reference}`, changes);
  }

  if (apply && updates.length) {
    await prisma.$transaction(
      updates.map(({ id, changes }) => prisma.invoice.update({ where: { id }, data: changes }))
    );
  }

  console.log(
    `${updates.length} facture(s) ${apply ? 'corrigée(s)' : 'à corriger — relancer avec --apply'}`
  );
};

if (require.main === module) {
  run({ apply: process.argv.includes('--apply') })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { planCreditNoteFix, planSaleRateFix, run };
