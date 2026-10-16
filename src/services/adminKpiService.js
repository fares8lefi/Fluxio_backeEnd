const prisma = require('../../config/db');
const { resolvePeriod, round, safeRatio, buildHttpError } = require('./managerService');

/* ────────────────────────────────────────────────────────────────────────────
 * Indicateurs de pilotage de la plateforme Fluxio (super-admin)
 *
 *  - Contrairement au service « manager », ces indicateurs ne sont PAS
 *    scopés à une entreprise : ils agrègent toute la plateforme. Les routes
 *    sont donc protégées par `isAdmin`.
 *  - La période réutilise `resolvePeriod` du service manager (mêmes clés :
 *    30d, month, prev_month, year, custom) pour un comportement homogène.
 *  - Toutes les requêtes passent par Prisma (paramétré) avec un `select`
 *    minimal ; les séries temporelles sont bornées (MAX_TREND_MONTHS).
 * ──────────────────────────────────────────────────────────────────────────── */

const DAY_MS = 86400000;
const DEFAULT_TREND_MONTHS = 12;
const MAX_TREND_MONTHS = 24;
const TOP_LIMIT_MAX = 50;
const TOP_CRITERIA = ['revenue', 'invoices', 'movements', 'users'];

// Seuils des alertes de santé
const DORMANT_DAYS = 30; // entreprise sans facture ni mouvement depuis N jours
const ONBOARDING_DAYS = 7; // entreprise créée depuis N jours sans aucun produit
const UNVERIFIED_HOURS = 48; // compte non activé (OTP) depuis N heures
const ALERT_LIST_LIMIT = 20;

/* ─────────────────────────────── Utilitaires ─────────────────────────────── */

/** Valeur + valeur précédente + variation en % (null si non comparable) */
const withDelta = (value, previous) => ({
  value,
  previous,
  delta_pct:
    Number(previous) > 0 ? round(((Number(value) - Number(previous)) / previous) * 100, 2) : null,
});

const daysAgo = (days, from = new Date()) => new Date(from.getTime() - days * DAY_MS);

const monthKey = (date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

const publicPeriod = (period) => ({
  key: period.key,
  label: period.label,
  startDate: period.startDate.toISOString(),
  endDate: period.endDate.toISOString(),
  previousStartDate: period.previous.startDate.toISOString(),
  previousEndDate: period.previous.endDate.toISOString(),
});

const parseBoundedInt = (raw, { fallback, min, max, name }) => {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw buildHttpError(`${name} doit être un entier entre ${min} et ${max}.`);
  }
  return value;
};

/* ───────────────────────── Indicateurs d'une période ─────────────────────── */

const SALE_NOT_CANCELLED = { invoice_type: 'SALE', status: { not: 'CANCELLED' } };

/**
 * Indicateurs « de flux » sur un intervalle : ce qui s'est passé pendant
 * la période (inscriptions, activité, volume d'affaires traité par Fluxio).
 */
const buildFlowSet = async (from, to) => {
  const range = { gte: from, lte: to };

  const [
    newCompanies,
    newUsers,
    activeUsers,
    invoiceAgg,
    paymentAgg,
    movementCount,
    quoteCount,
    quoteConverted,
    invitationsSent,
    invitationsAccepted,
    companiesWithInvoices,
    companiesWithMovements,
  ] = await Promise.all([
    prisma.company.count({ where: { created_at: range } }),
    prisma.user.count({ where: { created_at: range } }),
    prisma.user.count({ where: { last_login: range } }),
    prisma.invoice.aggregate({
      where: { ...SALE_NOT_CANCELLED, date: range },
      _sum: { total_ttc: true, total_ht: true },
      _count: { _all: true },
    }),
    prisma.payment.aggregate({ where: { date: range }, _sum: { amount: true } }),
    prisma.movement.count({ where: { created_at: range, status: { not: 'CANCELLED' } } }),
    prisma.quote.count({ where: { date: range } }),
    prisma.quote.count({ where: { date: range, status: 'CONVERTED' } }),
    prisma.invitation.count({ where: { created_at: range } }),
    prisma.invitation.count({ where: { accepted_at: range } }),
    prisma.invoice.groupBy({ by: ['companyId'], where: { date: range } }),
    prisma.movement.groupBy({ by: ['companyId'], where: { created_at: range } }),
  ]);

  // Entreprise « active » : au moins une facture ou un mouvement dans la période
  const activeCompanyIds = new Set(
    [...companiesWithInvoices, ...companiesWithMovements]
      .map((row) => row.companyId)
      .filter(Boolean)
  );

  const billedTtc = round(invoiceAgg._sum.total_ttc || 0);
  const collected = round(paymentAgg._sum.amount || 0);

  return {
    new_companies: newCompanies,
    new_users: newUsers,
    active_users: activeUsers,
    active_companies: activeCompanyIds.size,
    invoice_count: invoiceAgg._count._all || 0,
    revenue_billed_ttc: billedTtc,
    revenue_billed_ht: round(invoiceAgg._sum.total_ht || 0),
    payments_collected: collected,
    collection_rate_pct: safeRatio(collected, billedTtc),
    movement_count: movementCount,
    quote_count: quoteCount,
    quote_conversion_pct: safeRatio(quoteConverted, quoteCount),
    invitations_sent: invitationsSent,
    invitations_accepted: invitationsAccepted,
  };
};

/**
 * Photographie de la plateforme à l'instant T (stocks, pas des flux).
 */
const buildSnapshot = async () => {
  const now = new Date();

  const [
    totalCompanies,
    activeCompanies,
    totalUsers,
    activeUsers,
    wau,
    mau,
    roleGroups,
    totalProducts,
    totalClients,
    totalSuppliers,
    outstanding,
    pendingInvitations,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.company.count({ where: { is_active: true } }),
    prisma.user.count(),
    prisma.user.count({ where: { is_active: true } }),
    prisma.user.count({ where: { last_login: { gte: daysAgo(7, now) } } }),
    prisma.user.count({ where: { last_login: { gte: daysAgo(30, now) } } }),
    prisma.user.groupBy({ by: ['company_role'], _count: { _all: true } }),
    prisma.product.count(),
    prisma.client.count(),
    prisma.supplier.count(),
    prisma.invoice.aggregate({
      where: { invoice_type: 'SALE', status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
      _sum: { total_ttc: true, amount_paid: true },
    }),
    prisma.invitation.count({ where: { accepted_at: null, expires_at: { gt: now } } }),
  ]);

  const usersByRole = { OWNER: 0, STOCK: 0, ACCOUNTANT: 0 };
  for (const row of roleGroups) usersByRole[row.company_role] = row._count._all;

  return {
    companies: {
      total: totalCompanies,
      active: activeCompanies,
      suspended: totalCompanies - activeCompanies,
    },
    users: {
      total: totalUsers,
      active: activeUsers,
      suspended_or_unverified: totalUsers - activeUsers,
      activation_rate_pct: safeRatio(activeUsers, totalUsers),
      weekly_active: wau,
      monthly_active: mau,
      stickiness_pct: safeRatio(wau, mau), // WAU / MAU
      by_company_role: usersByRole,
      avg_per_company: totalCompanies > 0 ? round(totalUsers / totalCompanies, 2) : 0,
    },
    catalog: {
      products: totalProducts,
      clients: totalClients,
      suppliers: totalSuppliers,
    },
    receivables: {
      outstanding_ttc: round(
        (outstanding._sum.total_ttc || 0) - (outstanding._sum.amount_paid || 0)
      ),
    },
    pending_invitations: pendingInvitations,
  };
};

/* ─────────────────────────────── Endpoints ──────────────────────────────── */

/**
 * Vue d'ensemble : snapshot + indicateurs de la période comparés à la
 * période précédente de même durée.
 */
const getOverview = async (query = {}) => {
  const period = resolvePeriod(query);

  const [snapshot, current, previous] = await Promise.all([
    buildSnapshot(),
    buildFlowSet(period.startDate, period.endDate),
    buildFlowSet(period.previous.startDate, period.previous.endDate),
  ]);

  const kpis = {};
  for (const key of Object.keys(current)) kpis[key] = withDelta(current[key], previous[key]);

  return { period: publicPeriod(period), snapshot, kpis };
};

/**
 * Séries mensuelles sur les N derniers mois (inscriptions, activité, CA).
 * Les dates sont regroupées en JS : seules les colonnes de date/montant
 * sont lues, sur une fenêtre bornée.
 */
const getTrend = async (query = {}) => {
  const months = parseBoundedInt(query.months, {
    fallback: DEFAULT_TREND_MONTHS,
    min: 1,
    max: MAX_TREND_MONTHS,
    name: 'months',
  });

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const range = { gte: start, lte: now };

  const buckets = new Map();
  for (let i = 0; i < months; i += 1) {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    buckets.set(monthKey(date), {
      month: monthKey(date),
      new_companies: 0,
      new_users: 0,
      invoice_count: 0,
      revenue_billed_ttc: 0,
      payments_collected: 0,
      movement_count: 0,
    });
  }

  const add = (date, field, value = 1) => {
    const bucket = date && buckets.get(monthKey(new Date(date)));
    if (bucket) bucket[field] += value;
  };

  const [companies, users, invoices, payments, movements] = await Promise.all([
    prisma.company.findMany({ where: { created_at: range }, select: { created_at: true } }),
    prisma.user.findMany({ where: { created_at: range }, select: { created_at: true } }),
    prisma.invoice.findMany({
      where: { ...SALE_NOT_CANCELLED, date: range },
      select: { date: true, total_ttc: true },
    }),
    prisma.payment.findMany({ where: { date: range }, select: { date: true, amount: true } }),
    prisma.movement.findMany({
      where: { created_at: range, status: { not: 'CANCELLED' } },
      select: { created_at: true },
    }),
  ]);

  companies.forEach((c) => add(c.created_at, 'new_companies'));
  users.forEach((u) => add(u.created_at, 'new_users'));
  invoices.forEach((inv) => {
    add(inv.date, 'invoice_count');
    add(inv.date, 'revenue_billed_ttc', Number(inv.total_ttc) || 0);
  });
  payments.forEach((p) => add(p.date, 'payments_collected', Number(p.amount) || 0));
  movements.forEach((m) => add(m.created_at, 'movement_count'));

  const series = [...buckets.values()].map((b) => ({
    ...b,
    revenue_billed_ttc: round(b.revenue_billed_ttc),
    payments_collected: round(b.payments_collected),
  }));

  return { months, startDate: start.toISOString(), endDate: now.toISOString(), series };
};

/**
 * Classement des entreprises sur la période selon un critère.
 */
const getTopCompanies = async (query = {}) => {
  const period = resolvePeriod(query);
  const by = query.by ?? 'revenue';
  if (!TOP_CRITERIA.includes(by)) {
    throw buildHttpError(`Critère invalide. Valeurs acceptées : ${TOP_CRITERIA.join(', ')}.`);
  }
  const limit = parseBoundedInt(query.limit, {
    fallback: 10,
    min: 1,
    max: TOP_LIMIT_MAX,
    name: 'limit',
  });
  const range = { gte: period.startDate, lte: period.endDate };

  let rows;
  if (by === 'revenue') {
    rows = await prisma.invoice.groupBy({
      by: ['companyId'],
      where: { ...SALE_NOT_CANCELLED, date: range },
      _sum: { total_ttc: true },
      orderBy: { _sum: { total_ttc: 'desc' } },
      take: limit,
    });
    rows = rows.map((r) => ({ companyId: r.companyId, value: round(r._sum.total_ttc || 0) }));
  } else if (by === 'invoices') {
    rows = await prisma.invoice.groupBy({
      by: ['companyId'],
      where: { ...SALE_NOT_CANCELLED, date: range },
      _count: { _all: true },
      orderBy: { _count: { companyId: 'desc' } },
      take: limit,
    });
    rows = rows.map((r) => ({ companyId: r.companyId, value: r._count._all }));
  } else if (by === 'movements') {
    rows = await prisma.movement.groupBy({
      by: ['companyId'],
      where: { created_at: range, status: { not: 'CANCELLED' }, companyId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { companyId: 'desc' } },
      take: limit,
    });
    rows = rows.map((r) => ({ companyId: r.companyId, value: r._count._all }));
  } else {
    // users : utilisateurs actifs (connectés) sur la période
    rows = await prisma.user.groupBy({
      by: ['companyId'],
      where: { last_login: range, companyId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { companyId: 'desc' } },
      take: limit,
    });
    rows = rows.map((r) => ({ companyId: r.companyId, value: r._count._all }));
  }

  const companies = await prisma.company.findMany({
    where: { id: { in: rows.map((r) => r.companyId) } },
    select: { id: true, name: true, is_active: true, created_at: true },
  });
  const byId = new Map(companies.map((c) => [c.id, c]));

  return {
    period: publicPeriod(period),
    by,
    ranking: rows.map((r, index) => ({
      rank: index + 1,
      company: byId.get(r.companyId) || { id: r.companyId, name: null },
      value: r.value,
    })),
  };
};

/**
 * Santé de la plateforme : entreprises dormantes, onboarding bloqué,
 * comptes jamais vérifiés. Chaque alerte renvoie un compteur + un échantillon.
 */
const getHealth = async () => {
  const now = new Date();
  const dormantSince = daysAgo(DORMANT_DAYS, now);
  const onboardingSince = daysAgo(ONBOARDING_DAYS, now);
  const unverifiedSince = new Date(now.getTime() - UNVERIFIED_HOURS * 3600000);

  const [activeCompanies, recentInvoices, recentMovements, noProductCompanies, unverified] =
    await Promise.all([
      prisma.company.findMany({
        where: { is_active: true, created_at: { lt: dormantSince } },
        select: { id: true, name: true, created_at: true },
      }),
      prisma.invoice.groupBy({ by: ['companyId'], where: { date: { gte: dormantSince } } }),
      prisma.movement.groupBy({
        by: ['companyId'],
        where: { created_at: { gte: dormantSince } },
      }),
      prisma.company.findMany({
        where: { is_active: true, created_at: { lt: onboardingSince }, products: { none: {} } },
        select: { id: true, name: true, created_at: true },
        orderBy: { created_at: 'asc' },
      }),
      prisma.user.findMany({
        where: { is_active: false, last_login: null, created_at: { lt: unverifiedSince } },
        select: { id: true, username: true, email: true, created_at: true, companyId: true },
        orderBy: { created_at: 'asc' },
      }),
    ]);

  const recentlyActive = new Set(
    [...recentInvoices, ...recentMovements].map((row) => row.companyId).filter(Boolean)
  );
  const dormant = activeCompanies.filter((c) => !recentlyActive.has(c.id));

  const alert = (items, threshold) => ({
    count: items.length,
    threshold,
    sample: items.slice(0, ALERT_LIST_LIMIT),
  });

  return {
    generatedAt: now.toISOString(),
    dormant_companies: alert(dormant, `${DORMANT_DAYS} jours sans facture ni mouvement`),
    onboarding_incomplete: alert(
      noProductCompanies,
      `Aucun produit ${ONBOARDING_DAYS} jours après l'inscription`
    ),
    unverified_users: alert(unverified, `Compte non vérifié depuis ${UNVERIFIED_HOURS} h`),
  };
};

module.exports = {
  getOverview,
  getTrend,
  getTopCompanies,
  getHealth,
  // exportés pour les tests unitaires
  withDelta,
};
