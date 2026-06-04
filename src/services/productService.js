const productRepoitory = require('../repositories/prdouctRepository');
const productModel = require('../models/productModel');
const supplierModel = require('../models/suppliersModel');
const categoryModel = require('../models/categorieModel');

const productValidations = require('../validations/ProductValidations');
const {validateProductSearch} = require("../validations/ProductValidations");


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

const getProductByFiltres= async (data)=>{
    const validationResult = validateProductSearch(data);
    if (!validationResult.isValid) {
        const error = new Error('params not valid ');
        error.statusCode = 400;
        throw error;
    }
    const {name, unit, maxPrice, minPrice} = validationResult.data; // extract parsed & coerced data
    const filter = {};
    // Build dynamic filter object based on provided query parameters
    if (name) filter.name = { $regex: name, $options: 'i' }; // filter by name (case-insensitive)
    if (unit !== undefined) filter.unit = unit;               // filter by unit
    if (maxPrice !== undefined && minPrice !== undefined) {
        filter.selling_price = { $gte: minPrice, $lte: maxPrice }; // combined range
    } else if (maxPrice !== undefined) {
        filter.selling_price = { $lte: maxPrice };            // filter by max price
    } else if (minPrice !== undefined) {
        filter.selling_price = { $gte: minPrice };            // filter by min price
    }
    const products = await productRepoitory.getProductByFiltres(filter); // get data
    return products; // empty array handled by the controller
}
const getProductsBySupplier =async(data)=>{

}
module.exports = {
    addProduct,
    deleteProduct,
    getAllProducts,
    getProductById,
    getProductByFiltres,
}