const productRepoitory = require('../repositories/prdouctRepository');
const productModel = require('../models/productModel');
const supplierModel = require('../models/suppliersModel');
const categoryModel = require('../models/categorieModel');
const productValidations = require('../validations/ProductValidations');


const addProduct= async(data)=> {

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

module.exports = {
    addProduct
}