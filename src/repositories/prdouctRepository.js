const  productModel= require('../models/productModel');

const addProduct = async (data) => {
    return await productModel.create(data) ;
}

const updateProduct = async (data ,id) => {
    return await productModel.findByIdAndUpdate(id,data ,{new: true}) ;
}
const getAllProduct = async () => {
    return await productModel.find() ;
}
const getProductById = async (id) => {
    return await productModel.findById(id).select('code name unit')
        .populate({ path: 'supplier', select: 'name' })
        .populate({ path: 'categories', select: 'name' });
}
const deleteProduct = async (id) => {
    return await categoryModel.findByIdAndDelete(id) ;
}
const getProductByFiltres = async(data)=>{
    return await productModel.find(data).populate('supplier').populate('categories');
}
module.exports = {
    addProduct,
    updateProduct,
    getAllProduct,
    getProductById,
    deleteProduct,
    getProductByFiltres,
}