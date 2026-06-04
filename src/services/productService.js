const productRepoitory = require('../repositories/prdouctRepository');
const productModel = require('../models/productModel');
const supplierModel = require('../models/suppliersModel');
const categoryModel = require('../models/categorieModel');

const productValidations = require('../validations/ProductValidations');


const addProduct= async(data , user)=> {

    const validationResult = await productValidations.validateProductRegistration(data);
    if (!validationResult.isValid) {
        const error = new Error('Validation échouée');
        error.statusCode = 400;
        error.details = validationResult.errors;
        throw error;
    }

    const {code, barcode, name, purchase_price, selling_price, unit, stock_min, upplier, categories} = data
    const suppliers = await supplierModel.findById(upplier);
    if (!suppliers) {
        const error = new Error('supplier not found ');
        error.statusCode = 404;
        throw error;
    }
    const cat = await categoryModel.findById(categories);
    if(!cat){
        const error = new Error('category not found ');
        error.statusCode = 404;
        throw error;
    }
    return await productRepoitory.addProduct({code, barcode, name, purchase_price, selling_price, unit, stock_min, upplier, categories});
}


const deleteProduct= async(data )=> {
    const verifProduct = await productModel.findById(data);
    if(!data){
        const error = new Error('product not found ');
        error.statusCode = 400;
        throw error;
    }
    return await productRepoitory.deleteProduct(data);
}

const getAllProducts = async()=>{
    return await productRepoitory.getAllProduct();
}
// get product by id
const getProductById = async (data)=>{
    const product=  await productRepoitory.getProductById(data);
    if(!product){
        const error = new Error('product not found ');
        error.statusCode = 400;
        throw error;
    }
    return product;
}


module.exports = {
    addProduct,
    deleteProduct,
    getAllProducts,
    getProductById,
}