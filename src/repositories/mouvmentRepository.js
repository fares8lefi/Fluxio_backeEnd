const prisma = require('../../config/db');

// Crée un nouveau mouvement avec ses items et calcule le total_amount
const create = async (data, tx = prisma) => {
    const { items, supplierId, clientId, createdById, companyId, ...rest } = data;

    // Calcul du montant total figé au moment du mouvement
    const total_amount = items.reduce((sum, item) => {
        return sum + (item.unit_price ?? 0) * item.quantity;
    }, 0);

    return  tx.movement.create({
        data: {
            ...rest,
            total_amount,
            company:    companyId  ? { connect: { id: companyId  } } : undefined,
            supplier:   supplierId ? { connect: { id: supplierId } } : undefined,
            client:     clientId   ? { connect: { id: clientId   } } : undefined,
            created_by: { connect: { id: createdById } },
            items: {
                create: items.map((item) => ({
                    quantity:   item.quantity,
                    unit_price: item.unit_price ?? 0,
                    product:    { connect: { id: item.productId } },
                })),
            },
        },
        include: {
            items:      { include: { product: true } },
            supplier:   true,
            client:     true,
            created_by: { select: { id: true, username: true } },
        },
    });
};

// Récupère les mouvements avec pagination et filtres optionnels
const findPaginated = async (page, limit, companyId, filters = {}) => {
    const where = { companyId };

    if (filters.type)      where.type   = filters.type;
    if (filters.status)    where.status = filters.status;
    if (filters.clientId)  where.clientId  = filters.clientId;
    if (filters.supplierId) where.supplierId = filters.supplierId;

    if (filters.startDate || filters.endDate) {
        where.created_at = {};
        if (filters.startDate) where.created_at.gte = new Date(filters.startDate);
        if (filters.endDate)   where.created_at.lte = new Date(filters.endDate);
    }

    return prisma.movement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
            items:      { include: { product: true } },
            supplier:   true,
            client:     true,
            created_by: { select: { id: true, username: true } },
        },
        orderBy: { created_at: 'desc' },
    });
};

// Compte les mouvements avec les mêmes filtres
const countFiltered = async (companyId, filters = {}) => {
    const where = { companyId };
    if (filters.type)       where.type       = filters.type;
    if (filters.status)     where.status     = filters.status;
    if (filters.clientId)   where.clientId   = filters.clientId;
    if (filters.supplierId) where.supplierId = filters.supplierId;
    if (filters.startDate || filters.endDate) {
        where.created_at = {};
        if (filters.startDate) where.created_at.gte = new Date(filters.startDate);
        if (filters.endDate)   where.created_at.lte = new Date(filters.endDate);
    }
    return prisma.movement.count({ where });
};

// Récupère tous les mouvements d'un client donné
const findByClientId = async (clientId, companyId) => {
    return prisma.movement.findMany({
        where: { clientId, companyId },
        include: {
            items:      { include: { product: true } },
            supplier:   true,
            client:     true,
            created_by: { select: { id: true, username: true } },
        },
        orderBy: { created_at: 'desc' },
    });
};

// Récupère tous les mouvements d'un fournisseur donné
const findBySupplierId = async (supplierId, companyId) => {
    return prisma.movement.findMany({
        where: { supplierId, companyId },
        include: {
            items:      { include: { product: true } },
            supplier:   true,
            client:     true,
            created_by: { select: { id: true, username: true } },
        },
        orderBy: { created_at: 'desc' },
    });
};

// Compte le nombre total de mouvements
const countAll = async (companyId) => {
    return  prisma.movement.count({ where: { companyId } });
};

// Récupère un mouvement par ID avec ses items et produits
const getById = async (id, companyId, tx = prisma) => {
    return tx.movement.findFirst({
        where: { id, companyId },
        include: { 
            items: { include: { product: true } }
        }
    });
};

// Met à jour le statut d'un mouvement
const updateStatus = async (id, status, tx = prisma) => {
    return tx.movement.update({
        where: { id },
        data: { status }
    });
};

module.exports = {
    create,
    findPaginated,
    countAll,
    countFiltered,
    getById,
    updateStatus,
    findByClientId,
    findBySupplierId,
};