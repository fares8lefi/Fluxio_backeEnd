const prisma = require('../../config/db');

const getDashboardSummary = async (companyId) => {
    // 1. Chiffre d'affaires total (factures payées)
    const paidInvoices = await prisma.invoice.aggregate({
        where: { companyId, status: 'PAID' },
        _sum: { total_ttc: true }
    });
    const totalRevenue = paidInvoices._sum.total_ttc || 0;

    // 2. Nombre total de ventes (mouvements OUT)
    const totalSales = await prisma.movement.count({
        where: { companyId, type: 'OUT', status: { not: 'CANCELLED' } }
    });

    // 3. Produits en rupture de stock
    const outOfStockProducts = await prisma.product.count({
        where: { companyId, stock_quantity: { lte: 0 } }
    });

    // 4. Les 5 dernières factures
    const recentInvoices = await prisma.invoice.findMany({
        where: { companyId },
        orderBy: { date: 'desc' },
        take: 5,
        include: { client: { select: { name: true } } }
    });

    return {
        totalRevenue,
        totalSales,
        outOfStockProducts,
        recentInvoices
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
        totalRevenueTTC: result._sum.total_ttc   || 0,
        totalRevenueHT:  result._sum.total_ht    || 0,
        totalTVA:        result._sum.tva_amount  || 0,
        invoiceCount:    result._count.id        || 0,
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
        totals[pid].totalRevenue  += item.quantity * item.unit_price;
    }

    return Object.values(totals)
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 5)
        .map(t => ({
            ...t,
            totalRevenue: parseFloat(t.totalRevenue.toFixed(3)),
        }));
};

module.exports = {
    getDashboardSummary,
    getDashboardRevenue,
    getTopProducts,
};
