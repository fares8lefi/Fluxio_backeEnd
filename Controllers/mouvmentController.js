const mouvmentModel = require('../models/mouvmentModel');


const increaseStock = async (productId, quantity) => {
    try {
        const product = await mouvmentModel.findById(productId);
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
