// noinspection JSUnresolvedVariable,JSValidateTypes,JSCheckFunctionSignatures
// Couche d'accès aux données pour les produits — toutes les opérations Prisma (CRUD, pagination, agrégations).
const prisma = require('../../config/db');

/**
 * Calcule price_ht et price_ttc à partir du prix d'achat et du taux TVA.
 * Ces champs ne sont plus stockés en DB (évite les incohérences).
 */
const computePrices = (product) => {
    if (!product) return product;
    const tva = product.tva_rate ?? 19;
    const price_ht  = parseFloat((product.purchase_price / (1 + tva / 100)).toFixed(3));
    const price_ttc = parseFloat((product.selling_price  * (1 + tva / 100)).toFixed(3));
    return { ...product, price_ht, price_ttc };
};

// Crée un produit
const addProduct = async (data) => {
    const { categoryId, supplierId, companyId, ...rest } = data;
    const product = await prisma.product.create({
        data: {
            ...rest,
            company:  companyId  ? { connect: { id: companyId  } } : undefined,
            supplier: supplierId ? { connect: { id: supplierId } } : undefined,
            category: categoryId ? { connect: { id: categoryId } } : undefined,
        },
        include: { supplier: true, category: true },
    });
    return computePrices(product);
};

// Met à jour un produit
const updateProduct = async (data, id, companyId, tx = prisma) => {
    const { categoryId, supplierId, ...rest } = data;
    const product = await tx.product.update({
        where: { id, companyId },
        data: {
            ...rest,
            supplier: supplierId !== undefined
                ? supplierId ? { connect: { id: supplierId } } : { disconnect: true }
                : undefined,
            category: categoryId !== undefined
                ? categoryId ? { connect: { id: categoryId } } : { disconnect: true }
                : undefined,
        },
        include: { supplier: true, category: true },
    });
    return computePrices(product);
};

// Récupère tous les produits (sans pagination)
const getAllProduct = async (companyId) => {
    const products = await prisma.product.findMany({
        where: { companyId },
        include: { supplier: true, category: true },
    });
    return products.map(computePrices);
};

// Récupère les produits avec pagination + relations
const findPaginated = async (page, limit, companyId) => {
    const products = await prisma.product.findMany({
        where: { companyId },
        skip: (page - 1) * limit,
        take: limit,
        include: { supplier: true, category: true },
    });
    return products.map(computePrices);
};

// Compte le total des produits
const countAll = async (companyId) => {
    return  prisma.product.count({ where: { companyId } });
};

// Récupère un produit par ID (champs limités + relations)
const getProductById = async (id, companyId, tx = prisma) => {
    const product = await tx.product.findFirst({
        where: { id, companyId },
        select: {
            id: true, code: true, name: true,
            stock_quantity: true, tva_rate: true,
            purchase_price: true, selling_price: true, stock_min: true,
            supplier:  { select: { name: true } },
            category:  { select: { name: true } },
        },
    });
    return computePrices(product);
};

// Supprime un produit
const deleteProduct = async (id, companyId, tx = prisma) => {
    return  tx.product.delete({ where: { id, companyId } });
};

// Recherche par filtres dynamiques
const getProductByFiltres = async (filter) => {
    const products = await prisma.product.findMany({
        where: filter,
        include: { supplier: true, category: true },
    });
    return products.map(computePrices);
};

// Produits groupés par catégorie (avec fournisseur)
const getProductsByCategories = async (companyId) => {
    const products = await prisma.product.findMany({
        where: { companyId },
        include: {
            category: true,
            supplier: true,
        },
    });

    const grouped = {};
    for (const p of products) {
        const catName = p.category?.name ?? 'Sans catégorie';
        if (!grouped[catName]) grouped[catName] = { category: catName, count: 0, products: [] };
        grouped[catName].count++;
        grouped[catName].products.push({
            id:            p.id,
            name:          p.name,
            selling_price: p.selling_price,
            stock_quantity: p.stock_quantity,
            supplier:      p.supplier?.name ?? null,
        });
    }
    return Object.values(grouped);
};

// Nombre de produits par catégorie
const getSumProductByCategorie = async (companyId) => {
    const groups = await prisma.product.groupBy({
        by: ['categoryId'],
        where: { companyId },
        _count: { id: true },
    });

    return Promise.all(
        groups.map(async (g) => {
            const cat = g.categoryId
                ? await prisma.category.findUnique({ where: { id: g.categoryId } })
                : null;
            return { category: cat?.name ?? 'Sans catégorie', count: g._count.id };
        })
    );
};

// Produits avec leur fournisseur
const getSuppliersByProduct = async (companyId) => {
    const products = await prisma.product.findMany({
        where: { companyId },
        select: {
            name:     true,
            supplier: { select: { name: true } },
        },
    });
    return products.map((p) => ({
        productName: p.name,
        supplier:    p.supplier?.name ?? null,
    }));
};

// Produits dont le stock est en dessous du minimum
// Note: Prisma ne supporte pas la comparaison de deux colonnes dans un where,
// on récupère tous les produits et on filtre en JS.
const getProductsBelowStockMin = async (companyId) => {
    const products = await prisma.product.findMany({
        where: { companyId },
        select: {
            id: true, name: true, code: true,
            stock_quantity: true, stock_min: true,
            supplier: { select: { name: true } },
        },
    });
    return products.filter(p => p.stock_quantity < p.stock_min);
};

const getOutOfStockProducts = async (companyId) => {
    return prisma.product.findMany({
        where: {
            companyId,
            stock_quantity: { equals: 0 }
        },
        select: {
            id: true,
            name: true,
            code: true,
            stock_quantity: true
        }
    });
};

const getLowStockDashboard = async (companyId) => {
    const products = await prisma.product.findMany({
        where: { companyId },
        select: { stock_quantity: true, stock_min: true },
    });
    return products.filter(p => p.stock_quantity < p.stock_min).length;
}
module.exports = {
    addProduct,
    updateProduct,
    getAllProduct,
    findPaginated,
    countAll,
    getProductById,
    deleteProduct,
    getProductByFiltres,
    getProductsByCategories,
    getSumProductByCategorie,
    getSuppliersByProduct,
    getProductsBelowStockMin,
    getOutOfStockProducts,
    getLowStockDashboard
};
