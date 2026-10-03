const prisma = require('../../config/db');

const getDashboardSummary = async (companyId) => {
  // 1. Chiffre d'affaires total (factures payées)
  const paidInvoices = await prisma.invoice.aggregate({
    where: { companyId, status: 'PAID' },
    _sum: { total_ttc: true },
  });
  const totalRevenue = paidInvoices._sum.total_ttc || 0;

  // 2. Nombre total de ventes (mouvements OUT)
  const totalSales = await prisma.movement.count({
    where: { companyId, type: 'OUT', status: { not: 'CANCELLED' } },
  });

  // 3. Produits en rupture de stock
  const outOfStockProducts = await prisma.product.count({
    where: { companyId, stock_quantity: { lte: 0 } },
  });

  // 4. Les 5 dernières factures
  const recentInvoices = await prisma.invoice.findMany({
    where: { companyId },
    orderBy: { date: 'desc' },
    take: 5,
    include: { client: { select: { name: true } } },
  });

  return {
    totalRevenue,
    totalSales,
    outOfStockProducts,
    recentInvoices,
  };
};

/**
 * Chiffre d'affaires selon une période : week | month | year
 */
const getDashboardRevenue = async (companyId, period = 'month') => {
  const now = new Date();
  let startDate;

  if (period === 'week') {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 7);
  } else if (period === 'year') {
    startDate = new Date(now.getFullYear(), 0, 1);
  } else {
    // Défaut : month
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const result = await prisma.invoice.aggregate({
    where: {
      companyId,
      status: 'PAID',
      date: { gte: startDate, lte: now },
    },
    _sum: { total_ttc: true, total_ht: true, tva_amount: true },
    _count: { id: true },
  });

  return {
    period,
    startDate,
    endDate: now,
    totalRevenueTTC: result._sum.total_ttc || 0,
    totalRevenueHT: result._sum.total_ht || 0,
    totalTVA: result._sum.tva_amount || 0,
    invoiceCount: result._count.id || 0,
  };
};

/**
 * Top 5 produits les plus vendus (par quantité totale sortie)
 */
const getTopProducts = async (companyId) => {
  // Récupère les items de mouvements OUT non annulés
  const items = await prisma.movementItem.findMany({
    where: {
      movement: {
        companyId,
        type: 'OUT',
        status: { not: 'CANCELLED' },
      },
    },
    include: {
      product: { select: { id: true, name: true, code: true, selling_price: true } },
    },
  });

  // Agrège par produit
  const totals = {};
  for (const item of items) {
    const pid = item.productId;
    if (!totals[pid]) {
      totals[pid] = {
        product: item.product,
        totalQuantity: 0,
        totalRevenue: 0,
      };
    }
    totals[pid].totalQuantity += item.quantity;
    totals[pid].totalRevenue += item.quantity * item.unit_price;
  }

  return Object.values(totals)
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, 5)
    .map((t) => ({
      ...t,
      totalRevenue: parseFloat(t.totalRevenue.toFixed(3)),
    }));
};

/**
 * Synthèse de santé du stock et comparaison des seuils d'alerte
 */
const getStockHealth = async (companyId) => {
  const products = await prisma.product.findMany({
    where: { companyId },
    select: {
      id: true,
      name: true,
      code: true,
      stock_quantity: true,
      stock_min: true,
      stock_max: true,
      unit_of_measure: true,
      purchase_price: true,
      selling_price: true,
      category: { select: { name: true } },
    },
    orderBy: { stock_quantity: 'asc' },
  });

  let outOfStockCount = 0;
  let alertCount = 0;
  let optimalCount = 0;
  let overStockCount = 0;

  const categorized = products.map((p) => {
    let status = 'OPTIMAL';
    if (p.stock_quantity <= 0) {
      status = 'OUT_OF_STOCK';
      outOfStockCount++;
    } else if (p.stock_quantity <= p.stock_min) {
      status = 'ALERT';
      alertCount++;
    } else if (p.stock_max && p.stock_quantity >= p.stock_max) {
      status = 'OVERSTOCK';
      overStockCount++;
    } else {
      optimalCount++;
    }

    const alertCoveragePercent =
      p.stock_min > 0 ? Math.round((p.stock_quantity / p.stock_min) * 100) : 100;

    return {
      ...p,
      status,
      alertCoveragePercent,
      deficit: Math.max(0, p.stock_min - p.stock_quantity),
    };
  });

  const criticalProducts = categorized
    .filter((p) => p.status === 'OUT_OF_STOCK' || p.status === 'ALERT')
    .sort((a, b) => a.alertCoveragePercent - b.alertCoveragePercent)
    .slice(0, 10);

  const comparisonProducts = categorized.slice(0, 15);

  return {
    summary: {
      totalProducts: products.length,
      outOfStockCount,
      alertCount,
      optimalCount,
      overStockCount,
    },
    criticalProducts,
    comparisonProducts,
  };
};

/**
 * Historique temporel du stock réel vs seuil d'alerte pour un produit
 */
const getStockHistory = async (companyId, productId, days = 30) => {
  const daysCount = parseInt(days, 10) || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysCount);

  let targetProduct = null;
  if (productId && productId !== 'all') {
    targetProduct = await prisma.product.findFirst({
      where: { id: productId, companyId },
    });
  }

  if (!targetProduct) {
    targetProduct = await prisma.product.findFirst({
      where: { companyId },
      orderBy: { stock_quantity: 'asc' },
    });
  }

  if (!targetProduct) {
    return { product: null, history: [] };
  }

  const movementItems = await prisma.movementItem.findMany({
    where: {
      productId: targetProduct.id,
      movement: {
        companyId,
        status: { not: 'CANCELLED' },
        created_at: { gte: startDate },
      },
    },
    include: {
      movement: {
        select: {
          id: true,
          type: true,
          created_at: true,
          reference: true,
        },
      },
    },
    orderBy: { movement: { created_at: 'asc' } },
  });

  let netChangeInWindow = 0;
  movementItems.forEach((item) => {
    const isIncrease = item.movement.type === 'IN' || item.movement.type === 'RETURN_CLIENT';
    netChangeInWindow += isIncrease ? item.quantity : -item.quantity;
  });

  let runningStock = Math.max(0, targetProduct.stock_quantity - netChangeInWindow);

  const historyMap = {};
  for (let i = daysCount; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    historyMap[dateKey] = {
      date: dateKey,
      label,
      stockReel: runningStock,
      stockMin: targetProduct.stock_min,
      stockMax: targetProduct.stock_max || Math.round(targetProduct.stock_min * 2.5),
      entree: 0,
      sortie: 0,
    };
  }

  movementItems.forEach((item) => {
    const dateKey = item.movement.created_at.toISOString().split('T')[0];
    const isIncrease = item.movement.type === 'IN' || item.movement.type === 'RETURN_CLIENT';
    if (isIncrease) {
      runningStock += item.quantity;
      if (historyMap[dateKey]) historyMap[dateKey].entree += item.quantity;
    } else {
      runningStock = Math.max(0, runningStock - item.quantity);
      if (historyMap[dateKey]) historyMap[dateKey].sortie += item.quantity;
    }

    if (historyMap[dateKey]) {
      historyMap[dateKey].stockReel = runningStock;
    }
  });

  const sortedDates = Object.keys(historyMap).sort();
  let currentLevel = historyMap[sortedDates[0]].stockReel;
  sortedDates.forEach((dateKey) => {
    if (historyMap[dateKey].entree === 0 && historyMap[dateKey].sortie === 0) {
      historyMap[dateKey].stockReel = currentLevel;
    } else {
      currentLevel = historyMap[dateKey].stockReel;
    }
  });

  if (sortedDates.length > 0) {
    historyMap[sortedDates[sortedDates.length - 1]].stockReel = targetProduct.stock_quantity;
  }

  return {
    product: {
      id: targetProduct.id,
      name: targetProduct.name,
      code: targetProduct.code,
      stock_quantity: targetProduct.stock_quantity,
      stock_min: targetProduct.stock_min,
      stock_max: targetProduct.stock_max,
      unit_of_measure: targetProduct.unit_of_measure,
    },
    history: Object.values(historyMap),
  };
};

module.exports = {
  getDashboardSummary,
  getDashboardRevenue,
  getTopProducts,
  getStockHealth,
  getStockHistory,
};
