const mouvmentModel = require('../models/mouvmentModel');

const productModel = require('../models/productModel');
const { validateMouvmentRegistration } = require('../validations/mouvmentValidations');
const increaseStock = async (productId, quantity) => {
    try {
        const product = await productModel.findById(productId);
        if (!product) {
            throw new Error('Product not found');
        }
        product.quantity += quantity;
        await product.save();
    } catch (error) {
        throw error;
    }
};  

const decreaseStock = async (productId, quantity) => {
    try {
        const product = await mouvmentModel.findById(productId);
        if (!product) {
            throw new Error('Product not found');
        }
        product.quantity -= quantity;
        await product.save();
    } catch (error) {
        throw error;
    }
};  


module.exports.createMouvment = async (req , res)=>{
    try{
        
        const {type,unit,product,supplier,reference,note ,status}= req.body;
        const validationResult = validateMouvmentRegistration(req.body);
        if (!validationResult.isValid) {
            return res.status(400).json({success: false, message: validationResult.errors});
        }
        
        await mouvmentModel.create({
            type,
            unit,
            product,
            supplier,
            reference,
            note,
            status
        });
        
    
        res.status(200).json({message: "Mouvment created successfully" , success: true});
    }catch(error){
        res.status(500).json({message: error.message , success: false});
    }
}