const prisma = require('../../config/db');

/**
 * Exports CSV pour le comptable.
 * Format : séparateur « ; », virgule décimale, 3 décimales (millimes), BOM UTF-8 —
 * s'ouvre directement dans Excel (paramètres régionaux français) sans casser
 * les accents.
 */

const TVA_RATES = [0, 7, 13, 19];
const BOM = '﻿';

const httpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

/** Montant au format comptable français : 1234,500 */
const money = (n) => round3(n).toFixed(3).replace('.', ',');

const dateFr = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const pad = (v) => String(v).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
};

/** Échappe une cellule : guillemets si « ; », guillemet ou retour ligne */
const cell = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  // Neutralise les formules (=, +, -, @) injectées dans un tableur
  const safe = /^[=+\-@]/.test(text) && !/^-?\d/.test(text) ? `'${text}` : text;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Assemble un CSV (avec BOM) à partir d'un en-tête et de lignes */
const toCsv = (header, rows) =>
  BOM + [header, ...rows].map((row) => row.map(cell).join(';')).join('\r\n') + '\r\n';

const parseBreakdown = (json) => {
  try {
    return JSON.parse(json || '[]');
  } catch {
    return [];
  }
};

/** Base HT et TVA par taux d'une facture (avoirs en négatif) */
const byRate = (invoice) => {
  const sign = invoice.invoice_type === 'CREDIT_NOTE' ? -1 : 1;
  const out = Object.fromEntries(TVA_RATES.map((r) => [r, { base: 0, tva: 0 }]));
  const breakdown = parseBreakdown(invoice.tva_breakdown);
  if (breakdown.length === 0 && invoice.total_ht) {
    breakdown.push({ rate: 19, base_ht: invoice.total_ht, tva_amount: invoice.tva_amount });
  }
  for (const t of breakdown) {
    const rate = TVA_RATES.includes(Number(t.rate)) ? Number(t.rate) : 19;
    out[rate].base += sign * Math.abs(Number(t.base_ht) || 0);
    out[rate].tva += sign * Math.abs(Number(t.tva_amount) || 0);
  }
  return out;
};

const STATUS_LABELS = {
  PENDING: 'En attente',
  PARTIALLY_PAID: 'Partiellement payée',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
};

/**
 * « AAAA-MM-JJ » → minuit LOCAL (new Date('2026-10-01') serait minuit UTC,
 * soit 01:00 en Tunisie : les factures émises entre 00:00 et 01:00 seraient exclues).
 */
const parseDay = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
};

/** Période [from, to] inclusive ; défaut : mois en cours */
const resolveRange = (from, to) => {
  const now = new Date();
  const start = from ? parseDay(from) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = to ? parseDay(to) : now;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
    throw httpError('Dates invalides', 400);
  end.setHours(23, 59, 59, 999);
  if (start > end) throw httpError('La date de début doit précéder la date de fin', 400);
  return { start, end };
};

// ── Builders (purs, testables) ───────────────────────────────────────────

/**
 * Journal des ventes : une ligne par facture et avoir, numérotation complète
 * (les factures annulées restent listées, sans montants, pour justifier la séquence).
 */
const buildSalesJournal = (invoices) => {
  const header = [
    'Date',
    'N°',
    'Type',
    'Client',
    'MF client',
    ...TVA_RATES.map((r) => `Base HT ${r} %`),
    ...TVA_RATES.filter((r) => r > 0).map((r) => `TVA ${r} %`),
    'Total HT',
    'Total TVA',
    'Timbre',
    'Total TTC',
    'Retenue à la source',
    'Net à payer',
    'Statut',
    'Réglé',
    'Suspension TVA',
    "Facture d'origine",
  ];
  const rows = invoices.map((inv) => {
    const cancelled = inv.status === 'CANCELLED';
    const rates = byRate(inv);
    const amount = (v) => (cancelled ? money(0) : money(v));
    return [
      dateFr(inv.date),
      inv.reference,
      inv.invoice_type === 'CREDIT_NOTE' ? 'Avoir' : 'Facture',
      inv.client?.name ?? '',
      inv.client?.matriculeFiscale ?? '',
      ...TVA_RATES.map((r) => amount(rates[r].base)),
      ...TVA_RATES.filter((r) => r > 0).map((r) => amount(rates[r].tva)),
      amount(inv.total_ht),
      amount(inv.tva_amount),
      amount(inv.timbre_fiscal),
      amount(inv.total_ttc),
      amount(inv.rs_amount),
      amount(inv.net_payable ?? inv.total_ttc),
      STATUS_LABELS[inv.status] ?? inv.status,
      amount(inv.amount_paid),
      inv.is_suspended ? `Oui (${inv.attestation_ref ?? '—'})` : 'Non',
      inv.originalReference ?? '',
    ];
  });
  return toCsv(header, rows);
};

/** Totaux de TVA collectée par taux (factures − avoirs, hors annulées) */
const computeVatSummary = (invoices) => {
  const totals = Object.fromEntries(TVA_RATES.map((r) => [r, { base: 0, tva: 0 }]));
  let timbre = 0;
  let count = 0;
  for (const inv of invoices) {
    if (inv.status === 'CANCELLED') continue;
    count += 1;
    const rates = byRate(inv);
    for (const r of TVA_RATES) {
      totals[r].base += rates[r].base;
      totals[r].tva += rates[r].tva;
    }
    timbre += Number(inv.timbre_fiscal) || 0;
  }
  const lines = TVA_RATES.map((r) => ({
    rate: r,
    base_ht: round3(totals[r].base),
    tva: round3(totals[r].tva),
  }));
  return {
    lines,
    total_base_ht: round3(lines.reduce((s, l) => s + l.base_ht, 0)),
    total_tva: round3(lines.reduce((s, l) => s + l.tva, 0)),
    timbre: round3(timbre),
    invoice_count: count,
  };
};

const buildVatSummary = (summary, label) =>
  toCsv(
    ['Période', 'Taux TVA', 'Base HT', 'TVA collectée'],
    [
      ...summary.lines.map((l) => [label, `${l.rate} %`, money(l.base_ht), money(l.tva)]),
      [label, 'Total', money(summary.total_base_ht), money(summary.total_tva)],
      [label, 'Droit de timbre collecté', '', money(summary.timbre)],
      [label, 'Nombre de factures et avoirs', '', summary.invoice_count],
    ]
  );

// ── Données ──────────────────────────────────────────────────────────────

const loadInvoices = async (companyId, start, end) => {
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      invoice_type: { in: ['SALE', 'CREDIT_NOTE'] },
      date: { gte: start, lte: end },
    },
    orderBy: [{ date: 'asc' }, { reference: 'asc' }],
    include: { client: { select: { name: true, matriculeFiscale: true } } },
  });
  // Référence de la facture d'origine des avoirs
  const originIds = [...new Set(invoices.map((i) => i.original_invoice_id).filter(Boolean))];
  if (originIds.length > 0) {
    const origins = await prisma.invoice.findMany({
      where: { id: { in: originIds }, companyId },
      select: { id: true, reference: true },
    });
    const refs = new Map(origins.map((o) => [o.id, o.reference]));
    invoices.forEach((i) => {
      i.originalReference = refs.get(i.original_invoice_id) ?? null;
    });
  }
  return invoices;
};

const salesJournal = async (companyId, { from, to } = {}) => {
  const { start, end } = resolveRange(from, to);
  const csv = buildSalesJournal(await loadInvoices(companyId, start, end));
  return {
    csv,
    filename: `journal-ventes_${dateFr(start).replace(/\//g, '-')}_${dateFr(end).replace(/\//g, '-')}.csv`,
  };
};

/** Récapitulatif mensuel pour la déclaration de TVA — month = AAAA-MM */
const vatSummary = async (companyId, { month } = {}) => {
  const now = new Date();
  const [y, m] = (month || `${now.getFullYear()}-${now.getMonth() + 1}`).split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) throw httpError('Mois invalide (format AAAA-MM)', 400);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  const label = `${String(m).padStart(2, '0')}/${y}`;
  const summary = computeVatSummary(await loadInvoices(companyId, start, end));
  return {
    csv: buildVatSummary(summary, label),
    filename: `recap-tva_${y}-${String(m).padStart(2, '0')}.csv`,
  };
};

const products = async (companyId) => {
  const rows = await prisma.product.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
    include: { category: { select: { name: true } }, supplier: { select: { name: true } } },
  });
  return {
    filename: 'produits.csv',
    csv: toCsv(
      [
        'Code',
        'Code-barres',
        'Désignation',
        'Catégorie',
        'Fournisseur',
        'Unité',
        "Prix d'achat HT",
        'Prix de vente HT',
        'TVA %',
        'Stock',
        'Stock minimum',
        'Valeur du stock (achat)',
      ],
      rows.map((p) => [
        p.code,
        p.barcode,
        p.name,
        p.category?.name ?? '',
        p.supplier?.name ?? '',
        p.unit_of_measure,
        money(p.purchase_price),
        money(p.selling_price),
        p.tva_rate,
        p.stock_quantity,
        p.stock_min,
        money(p.purchase_price * p.stock_quantity),
      ])
    ),
  };
};

const clients = async (companyId) => {
  const rows = await prisma.client.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
  return {
    filename: 'clients.csv',
    csv: toCsv(
      ['Nom', 'Matricule fiscal', 'Code TVA', 'Téléphone', 'Adresse', 'Actif'],
      rows.map((c) => [
        c.name,
        c.matriculeFiscale,
        c.codeTva ?? '',
        c.phone,
        c.address ?? '',
        c.is_active ? 'Oui' : 'Non',
      ])
    ),
  };
};

const MOVEMENT_LABELS = {
  IN: 'Entrée',
  OUT: 'Sortie',
  RETURN_SUPPLIER: 'Retour fournisseur',
  RETURN_CLIENT: 'Retour client',
  ADJUSTMENT: 'Ajustement',
};

const movements = async (companyId, { from, to } = {}) => {
  const { start, end } = resolveRange(from, to);
  const rows = await prisma.movement.findMany({
    where: { companyId, created_at: { gte: start, lte: end } },
    orderBy: { created_at: 'asc' },
    include: {
      client: { select: { name: true } },
      supplier: { select: { name: true } },
      items: { include: { product: { select: { code: true, name: true } } } },
    },
  });
  // Une ligne par article : traçabilité produit par produit
  const lines = rows.flatMap((m) =>
    m.items.map((it) => [
      dateFr(m.created_at),
      m.reference ?? '',
      MOVEMENT_LABELS[m.type] ?? m.type,
      m.client?.name ?? m.supplier?.name ?? '',
      it.product?.code ?? '',
      it.product?.name ?? '',
      it.quantity,
      money(it.unit_price),
      money(it.quantity * it.unit_price),
      m.status === 'CANCELLED' ? 'Annulé' : 'Confirmé',
      m.note ?? '',
      m.supplier_invoice_ref
        ? `${m.supplier_invoice_ref}${m.supplier_invoice_date ? ` du ${dateFr(m.supplier_invoice_date)}` : ''}`
        : '',
    ])
  );
  return {
    filename: `mouvements_${dateFr(start).replace(/\//g, '-')}_${dateFr(end).replace(/\//g, '-')}.csv`,
    csv: toCsv(
      [
        'Date',
        'Référence',
        'Type',
        'Tiers',
        'Code article',
        'Article',
        'Quantité',
        'P.U. HT',
        'Total HT',
        'Statut',
        'Observations',
        'Facture fournisseur',
      ],
      lines
    ),
  };
};

module.exports = {
  salesJournal,
  vatSummary,
  products,
  clients,
  movements,
  // exportés pour les tests
  buildSalesJournal,
  resolveRange,
  computeVatSummary,
  toCsv,
  money,
  cell,
};
