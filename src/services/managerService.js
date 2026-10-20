const prisma = require('../../config/db');

// Statuts d'une facture « ouverte » (reste à payer)
const OPEN_STATUSES = ['PENDING', 'PARTIALLY_PAID'];
const { z } = require('zod');

/* ────────────────────────────────────────────────────────────────────────────
 * Service analytique « Pilotage » (page manager)
 *
 * SÉCURITÉ
 *  - Le `companyId` provient toujours de la session (req.user.companyId) :
 *    il n'est jamais lu dans la requête du client → pas de|IDOR possible.
 *  - Aucune requête SQL n'est concaténée : tout passe par le query builder
 *    Prisma (paramétré) → pas d'injection SQL possible.
 *  - Les paramètres de période sont validés par zod, avec une durée maximale
 *    (protection contre les requêtes coûteuses / DoS).
 *
 * PERFORMANCE
 *  - Agrégats et `groupBy` dès que possible (le calcul reste en base) ; le JS
 *    n'est utilisé que pour les agrégats impossibles à exprimer (qté × prix,
 *    JSON `tva_breakdown`).
 *  - `select` minimal sur chaque requête : pas de `include` large.
 *  - Cache mémoire TTL (60 s) par (entreprise, bloc, période) + cache du
 *    snapshot de stock et des analyses de ventes : inutile de recalculer quand
 *    l'utilisateur change de période puis revient en arrière.
 * ──────────────────────────────────────────────────────────────────────────── */

const CACHE_TTL_MS = 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const TREND_MONTHS = 12;
const MAX_RANGE_DAYS = 366 * 3; // 3 ans : au-delà la requête est refusée (400)

const PERIOD_KEYS = ['30d', 'month', 'prev_month', 'year', 'custom'];

/* ─────────────────────────────── Utilitaires ─────────────────────────────── */

const httpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const round = (value, digits = 3) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};

/** Division protégée : jamais de NaN/Infinity dans le JSON */
const safeRatio = (part, total, digits = 2) =>
  Number(total) > 0 ? round((Number(part) / Number(total)) * 100, digits) : 0;

const safeDivide = (part, total, digits = 3) =>
  Number(total) > 0 ? round(Number(part) / Number(total), digits) : 0;

const sum = (rows, field) => rows.reduce((acc, row) => acc + (Number(row?.[field]) || 0), 0);

/** Valeur d'une quantité en stock : un stock négatif (anomalie, comptée à part) vaut 0 */
const stockValue = (quantity, price) => Math.max(Number(quantity) || 0, 0) * (Number(price) || 0);

/* ────────────────────────────────── Cache ────────────────────────────────── */

const cacheStore = new Map();

const withCache = async (key, loader) => {
  const hit = cacheStore.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const value = await loader();

  if (cacheStore.size >= CACHE_MAX_ENTRIES) {
    cacheStore.delete(cacheStore.keys().next().value);
  }
  cacheStore.set(key, { at: Date.now(), value });
  return value;
};

/** Vide le cache (tests / invalidation manuelle) */
const clearCache = () => cacheStore.clear();

/* ───────────────────────────────── Période ───────────────────────────────── */

const periodSchema = z.object({
  period: z.enum(PERIOD_KEYS).optional(),
  startDate: z.string().max(40).optional(),
  endDate: z.string().max(40).optional(),
});

/*
 * Les périodes suivent l'heure de Tunis (UTC+1 toute l'année, pas d'heure d'été
 * depuis 2009) : une facture émise le 1er à 00 h 30 appartient bien à ce mois-là.
 * Les dates restent stockées en UTC ; seules les bornes et les regroupements
 * mensuels sont décalés.
 */
const TZ = 'Africa/Tunis';
const TZ_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 86400000;

/** Date « murale » de Tunis, lue avec les accesseurs getUTC* */
const local = (date) => new Date(date.getTime() + TZ_OFFSET_MS);
/** Instant UTC correspondant à une date murale de Tunis */
const fromLocal = (y, m, d = 1) => new Date(Date.UTC(y, m, d) - TZ_OFFSET_MS);

const startOfMonth = (date) => {
  const l = local(date);
  return fromLocal(l.getUTCFullYear(), l.getUTCMonth());
};

const endOfMonth = (date) => {
  const l = local(date);
  return new Date(fromLocal(l.getUTCFullYear(), l.getUTCMonth() + 1).getTime() - 1);
};

const startOfDay = (date) => {
  const l = local(date);
  return fromLocal(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate());
};

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

/** Début du mois décalé de `offset` mois */
const shiftMonth = (date, offset) => {
  const l = local(date);
  return fromLocal(l.getUTCFullYear(), l.getUTCMonth() + offset);
};

const monthKey = (date) => {
  const l = local(date);
  return `${l.getUTCFullYear()}-${String(l.getUTCMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (date) =>
  date.toLocaleDateString('fr-FR', { month: 'short', timeZone: TZ }).replace('.', '');

const dayLabel = (date) =>
  date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', timeZone: TZ });

const monthLongLabel = (date) =>
  date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: TZ });

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Borne d'une période personnalisée. Une date seule (AAAA-MM-JJ, envoyée par les
 * champs date du front) désigne la journée entière à Tunis : début à 00 h 00,
 * fin à 23 h 59 min 59,999 s — sinon le dernier jour serait exclu.
 */
const parseBound = (value, { end = false } = {}) => {
  if (value === undefined || value === null || value === '') return null;
  const match = DATE_ONLY.exec(value);
  if (match) {
    const start = fromLocal(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return end ? new Date(start.getTime() + DAY_MS - 1) : start;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Période précédente contiguë et de même durée : se termine juste avant `startDate` */
const previousSpan = (startDate, endDate) => {
  const length = endDate.getTime() - startDate.getTime() + 1;
  return {
    startDate: new Date(startDate.getTime() - length),
    endDate: new Date(startDate.getTime() - 1),
  };
};

/**
 * Traduit les paramètres de requête en intervalle daté + intervalle précédent
 * (pour la comparaison N-1). Bornes à l'heure de Tunis, bornes incluses.
 * @param {{period?: string, startDate?: string, endDate?: string}} query
 */
const resolvePeriod = (query = {}) => {
  const parsed = periodSchema.safeParse({
    period: query.period ?? 'month',
    startDate: query.startDate,
    endDate: query.endDate,
  });

  if (!parsed.success) {
    throw httpError(`Période invalide. Valeurs acceptées : ${PERIOD_KEYS.join(', ')}.`);
  }

  const { period, startDate: rawStart, endDate: rawEnd } = parsed.data;
  const now = new Date();

  if (period === 'custom') {
    const startDate = parseBound(rawStart);
    const endDate = parseBound(rawEnd, { end: true });
    if (!startDate || !endDate) {
      throw httpError('startDate et endDate sont obligatoires pour une période personnalisée.');
    }
    if (startDate > endDate) {
      throw httpError('startDate doit être antérieur à endDate.');
    }
    const spanDays = Math.round((endDate - startDate) / DAY_MS);
    if (spanDays > MAX_RANGE_DAYS) {
      throw httpError(`La période ne peut pas dépasser ${MAX_RANGE_DAYS} jours.`);
    }
    return {
      key: 'custom',
      label: `Du ${dayLabel(startDate)} au ${dayLabel(endDate)} ${local(startDate).getUTCFullYear()}`,
      startDate,
      endDate,
      previous: previousSpan(startDate, endDate),
      cacheKey: `custom:${startDate.toISOString()}:${endDate.toISOString()}`,
    };
  }

  if (period === '30d') {
    // Aujourd'hui compris : 30 journées entières, la dernière se terminant ce soir
    const startDate = addDays(startOfDay(now), -29);
    const endDate = new Date(addDays(startOfDay(now), 1).getTime() - 1);
    return {
      key: '30d',
      label: '30 derniers jours',
      startDate,
      endDate,
      previous: previousSpan(startDate, endDate),
      cacheKey: `30d:${startDate.toISOString()}`,
    };
  }

  if (period === 'prev_month') {
    const startDate = shiftMonth(now, -1);
    const endDate = endOfMonth(startDate);
    const previousStart = shiftMonth(startDate, -1);
    return {
      key: 'prev_month',
      label: `${monthLongLabel(startDate)} (mois précédent)`,
      startDate,
      endDate,
      previous: { startDate: previousStart, endDate: endOfMonth(previousStart) },
      cacheKey: `prev_month:${monthKey(startDate)}`,
    };
  }

  if (period === 'year') {
    const year = local(now).getUTCFullYear();
    const startDate = fromLocal(year, 0);
    const endDate = new Date(fromLocal(year + 1, 0).getTime() - 1);
    return {
      key: 'year',
      label: `Exercice ${year}`,
      startDate,
      endDate,
      previous: {
        startDate: fromLocal(year - 1, 0),
        endDate: new Date(startDate.getTime() - 1),
      },
      cacheKey: `year:${year}`,
    };
  }

  const startDate = startOfMonth(now);
  const endDate = endOfMonth(now);
  const previousStart = shiftMonth(startDate, -1);
  return {
    key: 'month',
    label: monthLongLabel(startDate),
    startDate,
    endDate,
    previous: { startDate: previousStart, endDate: endOfMonth(previousStart) },
    cacheKey: `month:${monthKey(startDate)}`,
  };
};

/**
 * Dernier mois des séries sur 12 mois : le mois de fin de la période, sans
 * dépasser le mois en cours (« Exercice en cours » finit sur le mois actuel,
 * pas sur janvier ni sur décembre à venir).
 */
const trendAnchor = (period) => {
  const now = new Date();
  return period.endDate < now ? period.endDate : now;
};

const publicPeriod = (period) => ({
  key: period.key,
  label: period.label,
  startDate: period.startDate.toISOString(),
  endDate: period.endDate.toISOString(),
  previousStartDate: period.previous.startDate.toISOString(),
  previousEndDate: period.previous.endDate.toISOString(),
});

/* ─────────────────────────── Filtres company-scopés ─────────────────────── */

const invoiceRange = (companyId, from, to, extra = {}) => ({
  companyId,
  date: { gte: from, lte: to },
  status: { not: 'CANCELLED' },
  ...extra,
});

const movementRange = (companyId, from, to, extra = {}) => ({
  companyId,
  created_at: { gte: from, lte: to },
  status: { not: 'CANCELLED' },
  ...extra,
});

/* ─────────────────────────── Chargements mis en cache ────────────────────── */

/** Snapshot du catalogue (lourd, très stable) — 1 requête, select minimal */
const loadStockSnapshot = (companyId) =>
  withCache(`stock:${companyId}`, async () => {
    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        where: { companyId },
        select: {
          id: true,
          name: true,
          code: true,
          stock_quantity: true,
          stock_min: true,
          stock_max: true,
          purchase_price: true,
          selling_price: true,
          tva_rate: true,
          categoryId: true,
        },
      }),
      prisma.category.findMany({
        where: { companyId },
        select: { id: true, name: true },
      }),
    ]);

    return { products, categoryNames: new Map(categories.map((c) => [c.id, c.name])) };
  });

/**
 * Factures « créditées » : celles qui ont reçu un avoir (total). Elles ne sont
 * plus dues : on les sort de l'encours, des impayés et du recouvrement. Leur
 * montant reste dans le CA, compensé par l'avoir (compté en négatif).
 * @returns {Promise<string[]>}
 */
const loadCreditedIds = (companyId) =>
  withCache(`credited:${companyId}`, async () => {
    const rows = await prisma.invoice.findMany({
      where: { companyId, invoice_type: 'CREDIT_NOTE', original_invoice_id: { not: null } },
      select: { original_invoice_id: true },
    });
    return [...new Set(rows.map((row) => row.original_invoice_id))];
  });

const ITEM_SELECT = {
  quantity: true,
  unit_price: true,
  purchase_price: true,
  product: { select: { purchase_price: true, categoryId: true } },
};

/**
 * Analyse des ventes FACTURÉES d'une période (même base que le CA) : volume,
 * CA HT et marge estimée, par catégorie. Les lignes viennent du mouvement de
 * chaque facture datée dans la période ; les avoirs datés dans la période
 * retirent les lignes de leur facture d'origine. Agrégation en JS (qté × prix
 * impossible en base sans SQL concaténé), résultat mis en cache.
 *
 * Les ventes non facturées sont suivies à part (bloc ventes, « non facturées »).
 *
 * ATTENTION — espace de noms `salesanalytics:` : partagé entre `buildKpiSet`
 * (tuiles) et `getManagerStock` (catégories) ; ne doit JAMAIS entrer en
 * collision avec la clé du bloc `getManagerSales` (sinon `byCategory` undefined
 * → 500 sur « Stock & achats »).
 */
const loadSalesAnalytics = (companyId, from, to, cacheSuffix) =>
  withCache(`salesanalytics:${companyId}:${cacheSuffix}`, async () => {
    const [sales, creditNotes] = await Promise.all([
      prisma.invoice.findMany({
        where: invoiceRange(companyId, from, to, { invoice_type: 'SALE', movementId: { not: null } }),
        select: { movement: { select: { items: { select: ITEM_SELECT } } } },
      }),
      prisma.invoice.findMany({
        where: invoiceRange(companyId, from, to, {
          invoice_type: 'CREDIT_NOTE',
          original_invoice_id: { not: null },
        }),
        select: { original_invoice_id: true },
      }),
    ]);

    const creditedOriginals = creditNotes.length
      ? await prisma.invoice.findMany({
          where: { companyId, id: { in: creditNotes.map((cn) => cn.original_invoice_id) } },
          select: { movement: { select: { items: { select: ITEM_SELECT } } } },
        })
      : [];

    const byCategory = new Map();
    let revenueHt = 0;
    let margin = 0;
    let volume = 0;
    let lineCount = 0;

    const addLines = (invoices, sign) =>
      invoices.forEach((invoice) =>
        (invoice.movement?.items ?? []).forEach((item) => {
          const quantity = sign * (Number(item.quantity) || 0);
          const price = Number(item.unit_price) || 0;
          // Prix d'achat figé sur la ligne (repli : fiche produit pour l'historique)
          const purchase = Number(item.purchase_price ?? item.product?.purchase_price) || 0;
          const lineTotal = quantity * price;
          const lineMargin = quantity * (price - purchase);

          revenueHt += lineTotal;
          margin += lineMargin;
          volume += quantity;
          lineCount += 1;

          const key = item.product?.categoryId ?? 'uncategorized';
          const bucket = byCategory.get(key) ?? { sales_ht: 0, margin: 0, volume: 0 };
          bucket.sales_ht += lineTotal;
          bucket.margin += lineMargin;
          bucket.volume += quantity;
          byCategory.set(key, bucket);
        })
      );

    addLines(sales, 1);
    addLines(creditedOriginals, -1);

    return {
      revenueHt: round(revenueHt),
      marginEstimated: round(margin),
      volume,
      byCategory,
      lineCount,
    };
  });

/** Règlements reçus sur la période (date du règlement, pas de la facture) */
const loadCollected = async (companyId, from, to) => {
  const agg = await prisma.payment.aggregate({
    where: { companyId, date: { gte: from, lte: to } },
    _sum: { amount: true },
  });
  return round(agg._sum.amount);
};

/**
 * Encours à ce jour : reste à payer de toutes les factures ouvertes, quelle que
 * soit leur date d'émission, hors factures créditées par un avoir.
 */
const loadOutstanding = async (companyId, creditedIds) => {
  const rows = await prisma.invoice.findMany({
    where: {
      companyId,
      invoice_type: 'SALE',
      status: { in: OPEN_STATUSES },
      id: { notIn: creditedIds },
    },
    select: {
      date: true,
      clientId: true,
      total_ttc: true,
      net_payable: true,
      amount_paid: true,
    },
  });
  return rows.map((row) => ({
    ...row,
    remaining: Math.max(
      (Number(row.net_payable ?? row.total_ttc) || 0) - (Number(row.amount_paid) || 0),
      0
    ),
  }));
};

/** Factures de vente et avoirs : les avoirs (TTC négatif) se compensent dans les sommes */
const BILLING_TYPES = { in: ['SALE', 'CREDIT_NOTE'] };

/** Classement clients par CA facturé net des avoirs sur une période (groupBy en base) */
const loadTopClients = (companyId, from, to, cacheSuffix, limit = 10) =>
  withCache(`topclients:${companyId}:${cacheSuffix}:${limit}`, async () => {
    const grouped = await prisma.invoice.groupBy({
      by: ['clientId'],
      where: invoiceRange(companyId, from, to, {
        invoice_type: BILLING_TYPES,
        clientId: { not: null },
      }),
      _sum: { total_ttc: true },
      orderBy: { _sum: { total_ttc: 'desc' } },
      take: limit,
    });

    if (grouped.length === 0) return [];
    const ids = grouped.map((row) => row.clientId);

    const [clients, counts] = await Promise.all([
      prisma.client.findMany({
        where: { companyId, id: { in: ids } },
        select: { id: true, name: true, matriculeFiscale: true },
      }),
      // Nombre de factures de vente (les avoirs ne sont pas des ventes)
      prisma.invoice.groupBy({
        by: ['clientId'],
        where: invoiceRange(companyId, from, to, { invoice_type: 'SALE', clientId: { in: ids } }),
        _count: { _all: true },
      }),
    ]);
    const names = new Map(clients.map((client) => [client.id, client]));
    const invoiceCounts = new Map(counts.map((row) => [row.clientId, row._count._all]));

    // Le CA total de la période est calculé par l'appelant : la part de chaque
    // client est donc rapportée au CA réel, pas au seul top N.
    return grouped.map((row) => ({
      id: row.clientId,
      name: names.get(row.clientId)?.name ?? 'Client supprimé',
      matriculeFiscale: names.get(row.clientId)?.matriculeFiscale ?? null,
      invoiced_ttc: round(row._sum.total_ttc),
      invoice_count: invoiceCounts.get(row.clientId) ?? 0,
    }));
  });

/* ─────────────────────────────────── KPIs ────────────────────────────────── */

/**
 * Recouvrement des factures émises sur la période : part du net à payer déjà
 * réglée, hors factures créditées (plus rien n'est dû dessus).
 */
const loadCohortRecovery = async (companyId, from, to, creditedIds) => {
  const agg = await prisma.invoice.aggregate({
    where: invoiceRange(companyId, from, to, {
      invoice_type: 'SALE',
      id: { notIn: creditedIds },
    }),
    _sum: { net_payable: true, total_ttc: true, amount_paid: true },
  });
  // Le client règle le net à payer (TTC − retenue à la source)
  const due = agg._sum.net_payable ?? agg._sum.total_ttc;
  return safeRatio(agg._sum.amount_paid, due);
};

const buildKpiSet = async (companyId, from, to, cacheSuffix) => {
  const creditedIds = await loadCreditedIds(companyId);

  const [billed, saleCount, collected, recoveryPct, purchasesAgg, activeClients, analytics] =
    await Promise.all([
      // Factures + avoirs : les avoirs (montants négatifs) viennent en déduction
      prisma.invoice.aggregate({
        where: invoiceRange(companyId, from, to, { invoice_type: BILLING_TYPES }),
        _sum: { total_ht: true, total_ttc: true, tva_amount: true, rs_amount: true },
      }),
      prisma.invoice.count({
        where: invoiceRange(companyId, from, to, { invoice_type: 'SALE' }),
      }),
      loadCollected(companyId, from, to),
      loadCohortRecovery(companyId, from, to, creditedIds),
      prisma.movement.aggregate({
        where: movementRange(companyId, from, to, { type: 'IN' }),
        _sum: { total_amount: true },
      }),
      prisma.client.count({ where: { companyId, is_active: true } }),
      loadSalesAnalytics(companyId, from, to, cacheSuffix),
    ]);

  const billedTtc = round(billed._sum.total_ttc);

  return {
    revenue_billed_ttc: billedTtc,
    revenue_billed_ht: round(billed._sum.total_ht),
    tva_amount: round(billed._sum.tva_amount),
    rs_amount: round(billed._sum.rs_amount),
    revenue_collected: collected,
    collection_rate_pct: recoveryPct,
    invoice_count: saleCount,
    average_basket: safeDivide(billedTtc, saleCount),
    margin_estimated: analytics.marginEstimated,
    sales_volume: analytics.volume,
    sales_volume_ht: analytics.revenueHt,
    purchase_total: round(purchasesAgg._sum.total_amount),
    client_count: activeClients,
  };
};

const withDelta = (current, previous) => ({
  value: current,
  previous,
  delta_pct: previous > 0 ? round(((current - previous) / previous) * 100, 1) : null,
});

/**
 * Tuiles « vue d'ensemble » avec comparaison à la période précédente
 */
const getManagerKpis = async (companyId, query = {}) => {
  const period = resolvePeriod(query);

  const data = await withCache(`kpis:${companyId}:${period.cacheKey}`, async () => {
    const [current, previous, snapshot, outstandingRows] = await Promise.all([
      buildKpiSet(companyId, period.startDate, period.endDate, period.cacheKey),
      buildKpiSet(
        companyId,
        period.previous.startDate,
        period.previous.endDate,
        `${period.cacheKey}:prev`
      ),
      loadStockSnapshot(companyId),
      loadCreditedIds(companyId).then((ids) => loadOutstanding(companyId, ids)),
    ]);

    const stockValueCost = round(
      snapshot.products.reduce((acc, p) => acc + stockValue(p.stock_quantity, p.purchase_price), 0)
    );

    return {
      period: publicPeriod(period),
      kpis: {
        revenue_billed_ttc: withDelta(current.revenue_billed_ttc, previous.revenue_billed_ttc),
        revenue_billed_ht: withDelta(current.revenue_billed_ht, previous.revenue_billed_ht),
        revenue_collected: withDelta(current.revenue_collected, previous.revenue_collected),
        collection_rate_pct: withDelta(current.collection_rate_pct, previous.collection_rate_pct),
        // Encours à ce jour (toutes dates d'émission) : pas de comparaison par période
        outstanding_ttc: {
          value: round(outstandingRows.reduce((acc, row) => acc + row.remaining, 0)),
          previous: null,
          delta_pct: null,
        },
        invoice_count: withDelta(current.invoice_count, previous.invoice_count),
        average_basket: withDelta(current.average_basket, previous.average_basket),
        margin_estimated: withDelta(current.margin_estimated, previous.margin_estimated),
        margin_estimated_note: 'Ventes facturées, nettes des avoirs, au prix d’achat du jour de la vente',
        sales_volume: withDelta(current.sales_volume, previous.sales_volume),
        purchase_total: withDelta(current.purchase_total, previous.purchase_total),
        stock_value_cost: { value: stockValueCost, previous: null, delta_pct: null },
        client_count: { value: current.client_count, previous: null, delta_pct: null },
      },
    };
  });

  return data;
};

/* ────────────────────────── Bloc 1 — Ventes & facturation ────────────────── */

const parseTvaBreakdown = (raw) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // donnée corrompue : on l'ignore plutôt que de casser la réponse
  }
};

const getManagerSales = async (companyId, query = {}) => {
  const period = resolvePeriod(query);

  return withCache(`salesblock:${companyId}:${period.cacheKey}`, async () => {
    const trendStart = shiftMonth(trendAnchor(period), -(TREND_MONTHS - 1));
    const creditedIds = await loadCreditedIds(companyId);

    const [
      invoices,
      trendRows,
      paymentRows,
      outstandingRows,
      recoveryPct,
      topClients,
      notInvoicedCount,
      notInvoicedAgg,
    ] = await Promise.all([
      prisma.invoice.findMany({
        where: invoiceRange(companyId, period.startDate, period.endDate, {
          invoice_type: BILLING_TYPES,
        }),
        select: {
          date: true,
          invoice_type: true,
          is_suspended: true,
          total_ht: true,
          total_ttc: true,
          tva_amount: true,
          timbre_fiscal: true,
          rs_amount: true,
          net_payable: true,
          tva_breakdown: true,
        },
      }),
      prisma.invoice.findMany({
        where: invoiceRange(companyId, trendStart, period.endDate, { invoice_type: BILLING_TYPES }),
        select: { date: true, total_ht: true, total_ttc: true, tva_amount: true },
      }),
      // Encaissements par date de règlement (série 12 mois et total de la période)
      prisma.payment.findMany({
        where: {
          companyId,
          // Couvre la série 12 mois et la période (plus longue qu'un an si personnalisée)
          date: {
            gte: trendStart < period.startDate ? trendStart : period.startDate,
            lte: period.endDate,
          },
        },
        select: { date: true, amount: true },
      }),
      loadOutstanding(companyId, creditedIds),
      loadCohortRecovery(companyId, period.startDate, period.endDate, creditedIds),
      loadTopClients(companyId, period.startDate, period.endDate, period.cacheKey, 5),
      prisma.movement.count({
        where: movementRange(companyId, period.startDate, period.endDate, {
          type: 'OUT',
          invoice: null,
        }),
      }),
      prisma.movement.aggregate({
        where: movementRange(companyId, period.startDate, period.endDate, {
          type: 'OUT',
          invoice: null,
        }),
        _sum: { total_amount: true },
      }),
    ]);

    const sales = invoices.filter((inv) => inv.invoice_type === 'SALE');
    const creditNotes = invoices.filter((inv) => inv.invoice_type === 'CREDIT_NOTE');

    const billedTtc = sum(sales, 'total_ttc');
    // Avoirs stockés en négatif : on affiche leur valeur absolue et on la retranche
    const creditNotesTtc = Math.abs(sum(creditNotes, 'total_ttc'));
    const netBilledTtc = billedTtc - creditNotesTtc;
    const inPeriod = (date) => date >= period.startDate && date <= period.endDate;
    const collectedTtc = sum(
      paymentRows.filter((row) => inPeriod(new Date(row.date))),
      'amount'
    );

    /* Ancienneté des impayés à ce jour (jours écoulés depuis l'émission) */
    const now = Date.now();
    const ageing = { lt_30: 0, '30_60': 0, gt_60: 0 };
    outstandingRows.forEach((row) => {
      const days = Math.floor((now - new Date(row.date).getTime()) / DAY_MS);
      if (days <= 30) ageing.lt_30 += row.remaining;
      else if (days <= 60) ageing['30_60'] += row.remaining;
      else ageing.gt_60 += row.remaining;
    });

    /*
     * Ventilation TVA par taux, nette des avoirs (leur ventilation est stockée en
     * positif : on la retranche). Les ventes en suspension forment une ligne à
     * part : leur base est exonérée, elle ne relève d'aucun taux.
     */
    const tvaMap = new Map();
    const suspended = { rate: null, suspended: true, base_ht: 0, tva_amount: 0 };
    invoices.forEach((inv) => {
      const sign = inv.invoice_type === 'CREDIT_NOTE' ? -1 : 1;
      parseTvaBreakdown(inv.tva_breakdown).forEach((line) => {
        const base = sign * Math.abs(Number(line.base_ht) || 0);
        if (inv.is_suspended) {
          suspended.base_ht += base;
          return;
        }
        const rate = Number(line.rate);
        if (!Number.isFinite(rate)) return;
        const bucket = tvaMap.get(rate) ?? { rate, suspended: false, base_ht: 0, tva_amount: 0 };
        bucket.base_ht += base;
        bucket.tva_amount += sign * Math.abs(Number(line.tva_amount) || 0);
        tvaMap.set(rate, bucket);
      });
    });
    const tvaRows = [...tvaMap.values()].sort((a, b) => a.rate - b.rate);
    if (suspended.base_ht !== 0) tvaRows.push(suspended);

    /* Série 12 mois : facturé net des avoirs (date de facture), encaissé (date de règlement) */
    const trendMap = new Map();
    for (let i = TREND_MONTHS - 1; i >= 0; i -= 1) {
      const date = shiftMonth(trendAnchor(period), -i);
      const key = monthKey(date);
      trendMap.set(key, {
        month: key,
        label: monthLabel(date),
        billed_ttc: 0,
        collected_ttc: 0,
        billed_ht: 0,
        tva: 0,
      });
    }
    trendRows.forEach((row) => {
      const bucket = trendMap.get(monthKey(new Date(row.date)));
      if (!bucket) return;
      bucket.billed_ttc += Number(row.total_ttc) || 0;
      bucket.billed_ht += Number(row.total_ht) || 0;
      bucket.tva += Number(row.tva_amount) || 0;
    });
    paymentRows.forEach((row) => {
      const bucket = trendMap.get(monthKey(new Date(row.date)));
      if (bucket) bucket.collected_ttc += Number(row.amount) || 0;
    });

    return {
      period: publicPeriod(period),
      totals: {
        billed_ht: round(sum(sales, 'total_ht')),
        tva: round(sum(sales, 'tva_amount')),
        timbre_fiscal: round(sum(sales, 'timbre_fiscal')),
        billed_ttc: round(billedTtc),
        collected_ttc: round(collectedTtc),
        rs_amount: round(sum(sales, 'rs_amount')),
        net_payable: round(sum(sales, 'net_payable')),
        suspended_ttc: round(sum(sales.filter((inv) => inv.is_suspended), 'total_ttc')),
        credit_notes_ttc: round(creditNotesTtc),
        net_after_credit_notes: round(netBilledTtc),
        invoice_count: sales.length,
        sale_invoice_count: sales.length,
        credit_note_count: creditNotes.length,
      },
      collection: {
        rate_pct: recoveryPct,
        outstanding_ttc: round(outstandingRows.reduce((acc, row) => acc + row.remaining, 0)),
        outstanding_invoice_count: outstandingRows.length,
        ageing: {
          lt_30: round(ageing.lt_30),
          '30_60': round(ageing['30_60']),
          gt_60: round(ageing.gt_60),
        },
      },
      tva_by_rate: tvaRows.map((row) => ({
        rate: row.rate,
        suspended: row.suspended,
        base_ht: round(row.base_ht),
        tva_amount: round(row.tva_amount),
      })),
      trend: [...trendMap.values()].map((row) => ({
        ...row,
        billed_ttc: round(row.billed_ttc),
        collected_ttc: round(row.collected_ttc),
        billed_ht: round(row.billed_ht),
        tva: round(row.tva),
      })),
      top_clients: topClients.map((row) => ({
        ...row,
        share_pct: safeRatio(row.invoiced_ttc, netBilledTtc),
      })),
      not_invoiced_sales: {
        count: notInvoicedCount,
        amount_ht: round(notInvoicedAgg._sum.total_amount),
      },
    };
  });
};

/* ──────────────────────────────── Bloc 2 — Clients ───────────────────────── */

const getManagerClients = async (companyId, query = {}) => {
  const period = resolvePeriod(query);

  return withCache(`clients:${companyId}:${period.cacheKey}`, async () => {
    const riskDate = addDays(new Date(), -60);
    const creditedIds = await loadCreditedIds(companyId);

    const [total, active, firstActivity, topClients, outstandingRows, billedAgg, billedClients] =
      await Promise.all([
        prisma.client.count({ where: { companyId } }),
        prisma.client.count({ where: { companyId, is_active: true } }),
        // 1re activité de chaque client → « nouveaux clients » de la période
        prisma.movement.groupBy({
          by: ['clientId'],
          where: { companyId, clientId: { not: null }, status: { not: 'CANCELLED' } },
          _min: { created_at: true },
        }),
        loadTopClients(companyId, period.startDate, period.endDate, period.cacheKey, 10),
        loadOutstanding(companyId, creditedIds),
        // CA net des avoirs des clients identifiés
        prisma.invoice.aggregate({
          where: invoiceRange(companyId, period.startDate, period.endDate, {
            invoice_type: BILLING_TYPES,
            clientId: { not: null },
          }),
          _sum: { total_ttc: true },
        }),
        // Tous les clients facturés sur la période (pas seulement le top 10)
        prisma.invoice.groupBy({
          by: ['clientId'],
          where: invoiceRange(companyId, period.startDate, period.endDate, {
            invoice_type: 'SALE',
            clientId: { not: null },
          }),
        }),
      ]);

    const newInPeriod = firstActivity.filter((row) => {
      const first = row._min?.created_at;
      if (!first) return false;
      return first >= period.startDate && first <= period.endDate;
    }).length;

    /* Clients à risque : reste à payer sur des factures émises il y a plus de 60 jours */
    const overdueByClient = new Map();
    outstandingRows
      .filter((row) => row.clientId && row.remaining > 0 && new Date(row.date) <= riskDate)
      .forEach((row) => {
        const entry = overdueByClient.get(row.clientId) ?? { remaining: 0, oldest: row.date };
        entry.remaining += row.remaining;
        if (new Date(row.date) < new Date(entry.oldest)) entry.oldest = row.date;
        overdueByClient.set(row.clientId, entry);
      });

    let atRisk = [];
    if (overdueByClient.size > 0) {
      const clients = await prisma.client.findMany({
        where: { companyId, id: { in: [...overdueByClient.keys()] } },
        select: { id: true, name: true },
      });
      const names = new Map(clients.map((client) => [client.id, client.name]));

      atRisk = [...overdueByClient.entries()]
        .map(([clientId, entry]) => ({
          id: clientId,
          name: names.get(clientId) ?? 'Client supprimé',
          outstanding_ttc: round(entry.remaining),
          oldest_invoice_date: new Date(entry.oldest).toISOString(),
          days_overdue: Math.floor((Date.now() - new Date(entry.oldest).getTime()) / DAY_MS),
        }))
        .sort((a, b) => b.outstanding_ttc - a.outstanding_ttc)
        .slice(0, 10);
    }

    const billedTtc = round(billedAgg._sum.total_ttc);
    const distinctClients = billedClients.length;
    const top5Total = topClients.slice(0, 5).reduce((acc, row) => acc + row.invoiced_ttc, 0);
    const top10Total = topClients.slice(0, 10).reduce((acc, row) => acc + row.invoiced_ttc, 0);

    return {
      period: publicPeriod(period),
      counts: {
        total,
        active,
        inactive: total - active,
        new_in_period: newInPeriod,
      },
      top_clients: topClients.map((row) => ({
        ...row,
        share_pct: safeRatio(row.invoiced_ttc, billedTtc),
      })),
      concentration: {
        top5_share_pct: safeRatio(top5Total, billedTtc),
        top10_share_pct: safeRatio(top10Total, billedTtc),
      },
      at_risk: atRisk,
      avg_basket_per_client: distinctClients ? safeDivide(billedTtc, distinctClients) : 0,
      billed_ttc: billedTtc,
    };
  });
};

/* ─────────────────────── Bloc 3 — Stock & achats ─────────────────────────── */

const getManagerStock = async (companyId, query = {}) => {
  const period = resolvePeriod(query);

  return withCache(`stockblock:${companyId}:${period.cacheKey}`, async () => {
    const last30 = addDays(new Date(), -30);

    const [
      snapshot,
      purchases,
      supplierReturns,
      clientReturns,
      soldGroups,
      dailySales,
      topSuppliers,
    ] = await Promise.all([
      loadStockSnapshot(companyId),
      prisma.movement.aggregate({
        where: movementRange(companyId, period.startDate, period.endDate, { type: 'IN' }),
        _sum: { total_amount: true },
        _count: { _all: true },
      }),
      prisma.movement.aggregate({
        where: movementRange(companyId, period.startDate, period.endDate, {
          type: 'RETURN_SUPPLIER',
        }),
        _sum: { total_amount: true },
        _count: { _all: true },
      }),
      prisma.movement.aggregate({
        where: movementRange(companyId, period.startDate, period.endDate, {
          type: 'RETURN_CLIENT',
        }),
        _sum: { total_amount: true },
        _count: { _all: true },
      }),
      prisma.movementItem.groupBy({
        by: ['productId'],
        where: { movement: movementRange(companyId, new Date(0), new Date(), { type: 'OUT' }) },
        _sum: { quantity: true },
      }),
      // Coût des marchandises sorties sur 30 jours (base de la couverture)
      prisma.movementItem.findMany({
        where: {
          movement: movementRange(companyId, last30, new Date(), { type: 'OUT' }),
        },
        select: {
          quantity: true,
          purchase_price: true,
          product: { select: { purchase_price: true } },
        },
      }),
      prisma.movement.groupBy({
        by: ['supplierId'],
        where: movementRange(companyId, period.startDate, period.endDate, {
          type: 'IN',
          supplierId: { not: null },
        }),
        _sum: { total_amount: true },
        _count: { _all: true },
        orderBy: { _sum: { total_amount: 'desc' } },
        take: 5,
      }),
    ]);

    const analytics = await loadSalesAnalytics(
      companyId,
      period.startDate,
      period.endDate,
      period.cacheKey
    );

    /* Valorisation du stock */
    let costValue = 0;
    let saleValue = 0;
    let outOfStock = 0;
    let belowMin = 0;
    let overstock = 0;
    let negativeStock = 0;
    const stockByCategory = new Map();

    snapshot.products.forEach((product) => {
      const quantity = Number(product.stock_quantity) || 0;
      const purchase = Number(product.purchase_price) || 0;
      const selling = Number(product.selling_price) || 0;

      costValue += stockValue(quantity, purchase);
      saleValue += stockValue(quantity, selling);

      if (quantity < 0) negativeStock += 1;
      if (quantity <= 0) outOfStock += 1;
      else if (quantity <= product.stock_min) belowMin += 1;
      else if (product.stock_max && quantity >= product.stock_max) overstock += 1;

      const key = product.categoryId ?? 'uncategorized';
      const bucket = stockByCategory.get(key) ?? { cost_value: 0, product_count: 0 };
      bucket.cost_value += stockValue(quantity, purchase);
      bucket.product_count += 1;
      stockByCategory.set(key, bucket);
    });

    /* Produits jamais vendus */
    const soldIds = new Set(soldGroups.map((row) => row.productId));
    const neverSold = snapshot.products.filter((product) => !soldIds.has(product.id));
    const neverSoldAmount = round(
      neverSold.reduce((acc, p) => acc + stockValue(p.stock_quantity, p.purchase_price), 0)
    );

    /*
     * Couverture en jours, en valeur : stock au coût / coût moyen des sorties par
     * jour sur 30 jours. Calculée en dinars, elle ne mélange pas des unités
     * différentes (m², sacs, pièces) comme le ferait une somme de quantités.
     */
    const cogs30 = dailySales.reduce(
      (acc, item) =>
        acc +
        (Number(item.quantity) || 0) *
          (Number(item.purchase_price ?? item.product?.purchase_price) || 0),
      0
    );
    const coverageDays = cogs30 > 0 ? Math.round(costValue / (cogs30 / 30)) : 0;

    /* Marge faible : produits du catalogue dont le prix de vente laisse moins de 10 % de marge */
    const lowMargin = snapshot.products
      .map((product) => {
        const purchase = Number(product.purchase_price) || 0;
        const selling = Number(product.selling_price) || 0;
        return {
          id: product.id,
          name: product.name,
          code: product.code,
          purchase_price: round(purchase),
          selling_price: round(selling),
          margin_pct: safeRatio(selling - purchase, selling),
        };
      })
      .filter((row) => row.margin_pct < 10)
      .sort((a, b) => a.margin_pct - b.margin_pct)
      .slice(0, 10);

    /* Par catégorie */
    const categoryKeys = new Set([...stockByCategory.keys(), ...analytics.byCategory.keys()]);
    const byCategory = [...categoryKeys]
      .map((key) => {
        const stock = stockByCategory.get(key) ?? { cost_value: 0, product_count: 0 };
        const sales = analytics.byCategory.get(key) ?? { sales_ht: 0, margin: 0 };
        return {
          category:
            key === 'uncategorized'
              ? 'Sans catégorie'
              : snapshot.categoryNames.get(key) || 'Catégorie supprimée',
          stock_cost_value: round(stock.cost_value),
          product_count: stock.product_count,
          sales_ht: round(sales.sales_ht),
          margin: round(sales.margin),
          margin_pct: safeRatio(sales.margin, sales.sales_ht),
        };
      })
      .sort((a, b) => b.sales_ht - a.sales_ht || b.stock_cost_value - a.stock_cost_value);

    /* Top fournisseurs */
    let supplierRows = [];
    if (topSuppliers.length > 0) {
      const suppliers = await prisma.supplier.findMany({
        where: { companyId, id: { in: topSuppliers.map((row) => row.supplierId) } },
        select: { id: true, name: true },
      });
      const names = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
      supplierRows = topSuppliers.map((row) => ({
        id: row.supplierId,
        name: names.get(row.supplierId) ?? 'Fournisseur supprimé',
        purchased_total: round(row._sum.total_amount),
        movement_count: row._count._all,
      }));
    }

    const salesHt = analytics.revenueHt;
    const returnsTotal = round(
      (supplierReturns._sum.total_amount || 0) + (clientReturns._sum.total_amount || 0)
    );

    return {
      period: publicPeriod(period),
      valuation: {
        cost_value: round(costValue),
        sale_value: round(saleValue),
        potential_margin: round(saleValue - costValue),
        margin_pct: safeRatio(saleValue - costValue, saleValue),
      },
      coverage_days: coverageDays,
      purchases: {
        total: round(purchases._sum.total_amount),
        movement_count: purchases._count._all,
      },
      returns: {
        supplier_total: round(supplierReturns._sum.total_amount),
        client_total: round(clientReturns._sum.total_amount),
        supplier_count: supplierReturns._count._all,
        client_count: clientReturns._count._all,
        total: returnsTotal,
        // Retours clients rapportés aux ventes facturées ; retours fournisseurs aux achats
        return_rate_pct: safeRatio(clientReturns._sum.total_amount, salesHt),
        supplier_return_rate_pct: safeRatio(
          supplierReturns._sum.total_amount,
          purchases._sum.total_amount
        ),
      },
      by_category: byCategory,
      top_suppliers: supplierRows,
      anomalies: {
        never_sold_count: neverSold.length,
        never_sold_amount: neverSoldAmount,
        negative_stock_count: negativeStock,
        out_of_stock_count: outOfStock,
        below_min_count: belowMin,
        overstock_count: overstock,
        low_margin_count: lowMargin.length,
      },
      low_margin_products: lowMargin,
    };
  });
};

/* ────────────────── Bloc 4 — Activité & conformité ──────────────────────── */

const getManagerActivity = async (companyId, query = {}) => {
  const period = resolvePeriod(query);

  return withCache(`activity:${companyId}:${period.cacheKey}`, async () => {
    const trendStart = shiftMonth(trendAnchor(period), -(TREND_MONTHS - 1));

    const [
      byType,
      cancelled,
      movementRows,
      saleLines,
      quotesAgg,
      convertedQuotes,
      salesWithoutClient,
      salesWithoutClientAgg,
      invoicesWithoutClient,
      clientsMissingMatricule,
      invalidTvaRates,
    ] = await Promise.all([
      prisma.movement.groupBy({
        by: ['type'],
        where: movementRange(companyId, period.startDate, period.endDate),
        _count: { _all: true },
      }),
      prisma.movement.count({
        where: {
          companyId,
          created_at: { gte: period.startDate, lte: period.endDate },
          status: 'CANCELLED',
        },
      }),
      prisma.movement.findMany({
        where: movementRange(companyId, trendStart, period.endDate),
        select: { created_at: true, total_amount: true, type: true },
      }),
      prisma.movementItem.findMany({
        where: {
          movement: movementRange(companyId, period.startDate, period.endDate, { type: 'OUT' }),
        },
        select: { quantity: true, unit_price: true, product: { select: { name: true } } },
      }),
      prisma.quote.aggregate({
        where: { companyId, created_at: { gte: period.startDate, lte: period.endDate } },
        _sum: { total_ttc: true },
        _count: { _all: true },
      }),
      prisma.quote.count({
        where: {
          companyId,
          status: 'CONVERTED',
          created_at: { gte: period.startDate, lte: period.endDate },
        },
      }),
      prisma.movement.count({
        where: movementRange(companyId, period.startDate, period.endDate, {
          type: 'OUT',
          clientId: null,
        }),
      }),
      prisma.movement.aggregate({
        where: movementRange(companyId, period.startDate, period.endDate, {
          type: 'OUT',
          clientId: null,
        }),
        _sum: { total_amount: true },
      }),
      prisma.invoice.count({
        where: invoiceRange(companyId, period.startDate, period.endDate, { clientId: null }),
      }),
      prisma.client.count({ where: { companyId, matriculeFiscale: '' } }),
      prisma.product.count({
        where: { companyId, NOT: { tva_rate: { in: [0, 7, 13, 19] } } },
      }),
    ]);

    const types = { IN: 0, OUT: 0, RETURN_SUPPLIER: 0, RETURN_CLIENT: 0 };
    byType.forEach((row) => {
      types[row.type] = row._count._all;
    });

    /* Activité mensuelle sur 12 mois */
    const monthly = new Map();
    for (let i = TREND_MONTHS - 1; i >= 0; i -= 1) {
      const date = shiftMonth(trendAnchor(period), -i);
      const key = monthKey(date);
      monthly.set(key, {
        month: key,
        label: monthLabel(date),
        movements: 0,
        in_amount: 0,
        out_amount: 0,
      });
    }
    movementRows.forEach((row) => {
      const bucket = monthly.get(monthKey(new Date(row.created_at)));
      if (!bucket) return;
      // Mouvements annulés déjà exclus par movementRange ; achats et ventes séparés
      bucket.movements += 1;
      if (row.type === 'IN') bucket.in_amount += Number(row.total_amount) || 0;
      if (row.type === 'OUT') bucket.out_amount += Number(row.total_amount) || 0;
    });

    /* Top produits vendus sur la période */
    const productMap = new Map();
    saleLines.forEach((line) => {
      const name = line.product?.name ?? 'Produit';
      const quantity = Number(line.quantity) || 0;
      const key = name;
      const bucket = productMap.get(key) ?? { name, quantity: 0, revenue_ht: 0 };
      bucket.quantity += quantity;
      bucket.revenue_ht += quantity * (Number(line.unit_price) || 0);
      productMap.set(key, bucket);
    });
    const topProducts = [...productMap.values()]
      .sort((a, b) => b.revenue_ht - a.revenue_ht)
      .slice(0, 10)
      .map((row) => ({
        name: row.name,
        quantity: row.quantity,
        revenue_ht: round(row.revenue_ht),
      }));

    const quoteCount = quotesAgg._count._all;
    const monthlyActivity = [...monthly.values()].map((row) => ({
      ...row,
      in_amount: round(row.in_amount),
      out_amount: round(row.out_amount),
    }));

    return {
      period: publicPeriod(period),
      movements: {
        by_type: types,
        total: Object.values(types).reduce((acc, value) => acc + value, 0),
        cancelled,
      },
      monthly_activity: monthlyActivity,
      top_products: topProducts,
      quotes: {
        count: quoteCount,
        amount: round(quotesAgg._sum.total_ttc),
        converted_count: convertedQuotes,
        conversion_rate_pct: safeRatio(convertedQuotes, quoteCount),
      },
      compliance: {
        sales_without_client_count: salesWithoutClient,
        sales_without_client_amount: round(salesWithoutClientAgg._sum.total_amount),
        invoices_without_client_count: invoicesWithoutClient,
        clients_missing_matricule_count: clientsMissingMatricule,
        products_invalid_tva_rate_count: invalidTvaRates,
      },
    };
  });
};

module.exports = {
  resolvePeriod,
  getManagerKpis,
  getManagerSales,
  getManagerClients,
  getManagerStock,
  getManagerActivity,
  clearCache,
  // exportés pour les tests unitaires
  buildHttpError: httpError,
  safeRatio,
  safeDivide,
  round,
};
