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

// Récupère les mouvements avec pagination
const findPaginated = async (page, limit, companyId) => {
    return  prisma.movement.findMany({
        where: { companyId },
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

// Compte le nombre total de mouvements
const countAll = async (companyId) => {
    return  prisma.movement.count({ where: { companyId } });
};

// Récupère un mouvement par ID avec ses items
const getById = async (id, companyId, tx = prisma) => {
    return tx.movement.findFirst({
        where: { id, companyId },
        include: { items: true }
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
    getById,
    updateStatus,
};