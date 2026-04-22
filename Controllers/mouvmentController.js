const mouvmentModel = require('../models/mouvmentModel');
const productModel = require('../models/productModel');
const { validateMouvmentRegistration } = require('../validations/mouvmentValidations');

const increaseStock = async (productId, quantity) => {
    try {
        const product = await productModel.findById(productId);
        if (!product) {
            throw new Error('Product not found');
        }
        product.unit += quantity;
        await product.save();
    } catch (error) {
        throw error;
    }
};  

const decreaseStock = async (productId, quantity) => {
    try {
        const product = await productModel.findById(productId);
        if (!product) {
            throw new Error('Product not found');
        }
        product.unit -= quantity;
        await product.save();
    } catch (error) {
        throw error;
    }
};  

module.exports.createMouvment = async (req, res) => {
    try {
       
    
        const user = (req.session && req.session.user) ? req.session.user : req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: "Utilisateur non authentifié" });
        }
        req.body.created_by = user._id;
        // set unit_price if not provided 
        if (req.body.items && Array.isArray(req.body.items)) {
            for (let item of req.body.items) {
                if (item.unit_price === undefined || item.unit_price === null) {
                    const product = await productModel.findById(item.product);
                    if (product) {
                        item.unit_price = ['OUT', 'RETURN_CLIENT'].includes(req.body.type)
                            ? product.selling_price
                            : product.purchase_price;
                    }
                }
            }
        }
       
        const validationResult = validateMouvmentRegistration(req.body);
        if (!validationResult.isValid) {
            return res.status(400).json({ success: false, message: validationResult.errors });
        }
        
        const { type, items, supplier, reference, note, status, created_by } = req.body;
        
        // Vérifier si le stock est suffisant pour les types sortant
        if (['OUT', 'RETURN_SUPPLIER'].includes(type)) {
            for (const item of items) {
                const product = await productModel.findById(item.product);
                if (!product) {
                    return res.status(404).json({ success: false, message: `Produit introuvable : ${item.product}` });
                }
                if (product.unit < item.unit) {
                    return res.status(400).json({ success: false, message: `Stock insuffisant pour le produit : ${product.name}` });
                }
            }
        }

        // Mettre à jour le stock pour chaque article
        for (const item of items) {
            if (['IN', 'RETURN_CLIENT'].includes(type)) {
                await increaseStock(item.product, item.unit);
            } else if (['OUT', 'RETURN_SUPPLIER'].includes(type)) {
                await decreaseStock(item.product, item.unit);
            }
        }
        
        
        const mouvment = await mouvmentModel.create({
            type,
            items,
            supplier: supplier ,
            reference: reference || null,
            note: note || null,
            status: status || 'CONFIRMED',
            created_by
        });

        res.status(201).json({ message: "Mouvment created successfully", success: true, mouvment: mouvment });
    } catch(error) {
        console.error(error);
        res.status(500).json({ message: error.message, success: false });
    }
};