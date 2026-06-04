// Couche d'accès aux données pour les produits : regroupe toutes les requêtes Mongoose (CRUD, pagination et pipelines d'agrégation).
const productModel = require('../models/productModel');

// Crée un produit
const addProduct = async (data) => {
    return await productModel.create(data);
};

// Met à jour un produit
const updateProduct = async (data, id) => {
    return await productModel.findByIdAndUpdate(id, data, { new: true })
        .populate('supplier')
        .populate('categories');
};

// Récupère tous les produits (sans pagination)
const getAllProduct = async () => {
    return await productModel.find();
};

// Récupère les produits avec pagination
const findPaginated = async (page, limit) => {
    return await productModel.find()
        .populate('supplier')
        .populate('categories')
        .skip((page - 1) * limit)
        .limit(limit);
};

// Compte le total des produits
const countAll = async () => {
    return await productModel.countDocuments();
};

// Récupère un produit par ID
const getProductById = async (id) => {
    return await productModel.findById(id).select('code name unit')
        .populate({ path: 'supplier', select: 'name' })
        .populate({ path: 'categories', select: 'name' });
};

// Supprime un produit
const deleteProduct = async (id) => {
    return await productModel.findByIdAndDelete(id);
};

// Recherche par filtres dynamiques
const getProductByFiltres = async (filter) => {
    return await productModel.find(filter).populate('supplier').populate('categories');
};

// Produits groupés par catégorie (avec fournisseur)
const getProductsByCategories = async () => {
    return await productModel.aggregate([
        { $unwind: '$categories' },
        {
            $lookup: {
                from: 'categories',
                localField: 'categories',
                foreignField: '_id',
                as: 'categoryInfo',
            },
        },
        { $unwind: '$categoryInfo' },
        {
            $lookup: {
                from: 'suppliers',
                localField: 'supplier',
                foreignField: '_id',
                as: 'supplierInfo',
            },
        },
        { $unwind: { path: '$supplierInfo', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: '$categoryInfo._id',
                categoryName: { $first: '$categoryInfo.name' },
                count: { $sum: 1 },
                products: {
                    $push: {
                        _id: '$_id',
                        name: '$name',
                        price: '$selling_price',
                        quantity: '$unit',
                        supplier: '$supplierInfo.name',
                    },
                },
            },
        },
        {
            $project: {
                _id: 0,
                category: '$categoryName',
                count: 1,
                products: 1,
            },
        },
    ]);
};

// Nombre de produits par catégorie
const getSumProductByCategorie = async () => {
    return await productModel.aggregate([
        { $unwind: '$categories' },
        {
            $lookup: {
                from: 'categories',
                localField: 'categories',
                foreignField: '_id',
                as: 'categoryInfo',
            },
        },
        { $unwind: '$categoryInfo' },
        {
            $group: {
                _id: '$categoryInfo.name',
                count: { $sum: 1 },
            },
        },
        {
            $project: {
                _id: 0,
                category: '$_id',
                count: 1,
            },
        },
    ]);
};

// Produits avec leur fournisseur
const getSuppliersByProduct = async () => {
    return await productModel.aggregate([
        {
            $lookup: {
                from: 'suppliers',
                localField: 'supplier',
                foreignField: '_id',
                as: 'supplierInfo',
            },
        },
        { $unwind: { path: '$supplierInfo', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 0,
                productName: '$name',
                supplier: '$supplierInfo.name',
            },
        },
    ]);
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