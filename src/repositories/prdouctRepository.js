// Couche d'accès aux données pour les produits — toutes les opérations Prisma (CRUD, pagination, agrégations).
const prisma = require('../../config/db');

// Crée un produit
const addProduct = async (data) => {
    const { categorieId, supplierId, ...rest } = data;
    return await prisma.product.create({
        data: {
            ...rest,
            supplier:  supplierId  ? { connect: { id: supplierId } }  : undefined,
            categorie: categorieId ? { connect: { id: categorieId } } : undefined,
        },
        include: { supplier: true, categorie: true },
    });
};

// Met à jour un produit
const updateProduct = async (data, id) => {
    const { categorieId, supplierId, ...rest } = data;
    return await prisma.product.update({
        where: { id: id },
        data: {
            ...rest,
            supplier: supplierId !== undefined
                ? supplierId ? { connect: { id: supplierId } } : { disconnect: true }
                : undefined,
            categorie: categorieId !== undefined
                ? categorieId ? { connect: { id: categorieId } } : { disconnect: true }
                : undefined,
        },
        include: { supplier: true, categorie: true },
    });
};

// Récupère tous les produits (sans pagination)
const getAllProduct = async () => {
    return await prisma.product.findMany({
        include: { supplier: true, categorie: true },
    });
};

// Récupère les produits avec pagination + relations
const findPaginated = async (page, limit) => {
    return await prisma.product.findMany({
        skip: (page - 1) * limit,
        take: limit,
        include: { supplier: true, categorie: true },
    });
};

// Compte le total des produits
const countAll = async () => {
    return await prisma.product.count();
};

// Récupère un produit par ID (champs limités + relations)
const getProductById = async (id) => {
    return await prisma.product.findUnique({
        where: { id: id },
        select: {
            id: true, code: true, name: true, unit: true,
            purchase_price: true, selling_price: true, stock_min: true,
            supplier:  { select: { name: true } },
            categorie: { select: { name: true } },
        },
    });
};

// Supprime un produit
const deleteProduct = async (id) => {
    return await prisma.product.delete({
        where: { id: id },
    });
};

// Recherche par filtres dynamiques
const getProductByFiltres = async (filter) => {
    return await prisma.product.findMany({
        where: filter,
        include: { supplier: true, categorie: true },
    });
};

// Produits groupés par catégorie (avec fournisseur)
const getProductsByCategories = async () => {
    const products = await prisma.product.findMany({
        include: {
            categorie: true,
            supplier:  true,
        },
    });

    const grouped = {};
    for (const p of products) {
        const catName = p.categorie?.name ?? 'Sans catégorie';
        if (!grouped[catName]) grouped[catName] = { category: catName, count: 0, products: [] };
        grouped[catName].count++;
        grouped[catName].products.push({
            id:       p.id,
            name:     p.name,
            price:    p.selling_price,
            quantity: p.unit,
            supplier: p.supplier?.name ?? null,
        });
    }
    return Object.values(grouped);
};

// Nombre de produits par catégorie
const getSumProductByCategorie = async () => {
    const groups = await prisma.product.groupBy({
        by: ['categorieId'],
        _count: { id: true },
    });

    // Récupère les noms des catégories
    const result = await Promise.all(
        groups.map(async (g) => {
            const cat = g.categorieId
                ? await prisma.categorie.findUnique({ where: { id: g.categorieId } })
                : null;
            return { category: cat?.name ?? 'Sans catégorie', count: g._count.id };
        })
    );
    return result;
};

// Produits avec leur fournisseur
const getSuppliersByProduct = async () => {
    const products = await prisma.product.findMany({
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
};