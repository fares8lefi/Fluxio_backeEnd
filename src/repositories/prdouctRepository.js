const categoryModel = require('../models/categorieModel');

const addProduct = async (data) => {
    return await categoryModel.create(data) ;
}

const updateProduct = async (data ,id) => {
    return await categoryModel.findByIdAndUpdate(id,data ,{new: true}) ;
}
const getAllProduct = async () => {
    return await categoryModel.find() ;
}
const getProductById = async (id) => {
    return await categoryModel.findById(id) ;
}
const deleteProduct = async (id) => {
    return await categoryModel.findByIdAndDelete(id) ;
}

module.exports = {
    addProduct,
    updateProduct,
    getAllProduct,
    getProductById,
    deleteProduct
}