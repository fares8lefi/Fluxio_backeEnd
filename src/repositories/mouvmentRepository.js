const prisma = require('../../config/db');

// Crée un nouveau mouvement avec ses items
const create = async (data) => {
    const { items, supplierId, createdById, ...rest } = data;

    return await prisma.movement.create({
        data: {
            ...rest,
            supplier: supplierId ? { connect: { id: parseInt(supplierId) } } : undefined,
            created_by: { connect: { id: parseInt(createdById) } },
            items: {
                create: items.map((item) => ({
                    unit: item.unit,
                    unit_price: item.unit_price ?? null,
                    product: { connect: { id: parseInt(item.product) } },
                })),
            },
        },
        include: {
            items: { include: { product: true } },
            supplier: true,
            created_by: { select: { id: true, username: true } },
        },
    });
};

// Récupère les mouvements avec pagination
const findPaginated = async (page, limit) => {
    return await prisma.movement.findMany({
        skip: (page - 1) * limit,
        take: limit,
        include: {
            items: { include: { product: true } },
            supplier: true,
            created_by: { select: { id: true, username: true } },
        },
        orderBy: { created_at: 'desc' },
    });
};

// Compte le nombre total de mouvements
const countAll = async () => {
    return await prisma.movement.count();
};

module.exports = {
    create,
    findPaginated,
    countAll,
};