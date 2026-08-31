const prisma = require('../../config/db');

const createInvoice = async (data, tx = prisma) => {
    return tx.invoice.create({
        data,
        include: {
            client: true,
            movement: {
                include: { items: { include: { product: true } } }
            },
            company: true
        }
    });
};

const getInvoiceById = async (id, companyId) => {
    return prisma.invoice.findFirst({
        where: { id, companyId },
        include: {
            client: true,
            movement: {
                include: { items: { include: { product: true } } }
            },
            company: true
        }
    });
};

const getInvoiceByMovementId = async (movementId, companyId) => {
    return prisma.invoice.findFirst({
        where: { movementId, companyId }
    });
};

const findPaginated = async (page, limit, companyId, filters = {}) => {
    const where = { companyId };
    if (filters.status)   where.status   = filters.status;
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.startDate || filters.endDate) {
        where.date = {};
        if (filters.startDate) where.date.gte = new Date(filters.startDate);
        if (filters.endDate)   where.date.lte = new Date(filters.endDate);
    }

    return prisma.invoice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date: 'desc' },
        include: { client: true }
    });
};

const countAll = async (companyId, filters = {}) => {
    const where = { companyId };
    if (filters.status)   where.status   = filters.status;
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.startDate || filters.endDate) {
        where.date = {};
        if (filters.startDate) where.date.gte = new Date(filters.startDate);
        if (filters.endDate)   where.date.lte = new Date(filters.endDate);
    }
    return prisma.invoice.count({ where });
};

const updateStatus = async (id, status, companyId) => {
    return prisma.invoice.update({
        where: { id, companyId },
        data: { status }
    });
};

module.exports = {
    createInvoice,
    getInvoiceById,
    getInvoiceByMovementId,
    findPaginated,
    countAll,
    updateStatus,
};
