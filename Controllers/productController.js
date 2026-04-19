const mongoose = require('mongoose');
const categorieModel = require("../models/categorieModel");
const supplierModel = require("../models/suppliersModel");
const productModel = require("../models/productModel");
const { validateProductRegistration, validateProductUpdate ,validateProductSearch} = require('../validations/ProductValidations');
module.exports.addProduct = async function (req, res) {
  try {
    const validationResult = validateProductRegistration(req.body);
    if (!validationResult.isValid) {
      return res.status(400).json({success: false, message: validationResult.errors});
    }
    const {
      code,
      barcode,
      name,
      purchase_price,
      selling_price,
      unit,
      stock_min,
      supplier,
      categories,
    } = req.body;

    // Vérifier si le fournisseur existe
    if (supplier) {
      if (!mongoose.Types.ObjectId.isValid(supplier)) {
        return res.status(400).json({ success: false, message: "Format d'ID fournisseur invalide" });
      }
      const supplierExists = await supplierModel.findById(supplier);
      if (!supplierExists) {
        return res.status(400).json({ success: false, message: "Fournisseur introuvable" });
      }
    }

    // Vérifier si les catégories existent
    if (categories && Array.isArray(categories)) {
      for (const catId of categories) {
        if (!mongoose.Types.ObjectId.isValid(catId)) {
          return res.status(400).json({ success: false, message: `Format d'ID catégorie invalide : ${catId}` });
        }
        const catExists = await categorieModel.findById(catId);
        if (!catExists) {
          return res.status(400).json({ success: false, message: `Catégorie introuvable : ${catId}` });
        }
      }
    }

    const newProduct = await productModel.create({
      code,
      barcode,
      name,
      purchase_price,
      selling_price,
      unit,
      stock_min,
      supplier: supplier || null,
      categories: categories || [],
    });

    return res
      .status(201)
      .json({ success: true, message: "Produit ajouté avec succès", product: newProduct });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message });
  }
};

module.exports.deleteProduct = async function (req, res) {
  try {
    const id = req.params.id;
    const verifId = await productModel.findById(id);
    if (!verifId) {
      return res.status(404).json({ success: false, message: "produit non trouvé" });
    }
    await productModel.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: "Produit supprimé avec succès" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.getAllProduct = async function (req, res) {
  try {
    const products = await productModel.find().populate('supplier').populate('categories');
    if (products.length === 0) {
      return res.status(404).json({ success: false, message: "aucun produit trouvé" });
    }
    return res.status(200).json({ success: true, products });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.updateProduct = async function (req, res) {
  try {
    const validationResult = validateProductUpdate(req.body);
    if (!validationResult.isValid) {
      return res.status(400).json({success: false, message: validationResult.errors});
    }
    const id = req.params.id;
    const {
      code,
      barcode,
      name,
      purchase_price,
      selling_price,
      unit,
      stock_min,
      supplier,
      categories,
    } = req.body;

    // Vérifier si le produit existe
    const product = await productModel.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Produit non trouvé" });
    }

    // Vérifier si le fournisseur existe (si fourni)
    if (supplier) {
      if (!mongoose.Types.ObjectId.isValid(supplier)) {
        return res.status(400).json({ success: false, message: "Format d'ID fournisseur invalide" });
      }
      const supplierExists = await supplierModel.findById(supplier);
      if (!supplierExists) {
        return res.status(400).json({ success: false, message: "Fournisseur introuvable" });
      }
    }

    // Vérifier si les catégories existent (si fournies)
    if (categories && Array.isArray(categories)) {
      for (const catId of categories) {
        if (!mongoose.Types.ObjectId.isValid(catId)) {
          return res.status(400).json({ success: false, message: `Format d'ID catégorie invalide : ${catId}` });
        }
        const catExists = await categorieModel.findById(catId);
        if (!catExists) {
          return res.status(400).json({ success: false, message: `Catégorie introuvable : ${catId}` });
        }
      }
    }

    // Construire l'objet de mise à jour avec seulement les champs fournis
    const updates = {};
    if (code !== undefined) updates.code = code;
    if (barcode !== undefined) updates.barcode = barcode;
    if (name !== undefined) updates.name = name;
    if (purchase_price !== undefined) updates.purchase_price = purchase_price;
    if (selling_price !== undefined) updates.selling_price = selling_price;
    if (unit !== undefined) updates.unit = unit;
    if (stock_min !== undefined) updates.stock_min = stock_min;
    if (supplier !== undefined) updates.supplier = supplier;
    if (categories !== undefined) updates.categories = categories;

    const updatedProduct = await productModel.findByIdAndUpdate(id, updates, { new: true })
      .populate('supplier')
      .populate('categories');

    return res.status(200).json({
      success: true,
      message: "Produit mis à jour avec succès",
      product: updatedProduct
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message });
  }
};

module.exports.getProductById = async function (req, res) {
  try {
    const id = req.params.id;
   const product = await productModel
  .findById(id)
  .select('code name unit') 
  .populate({ path: 'supplier', select: 'name' })
  .populate({ path: 'categories', select: 'name' });
    if (!product) {
      return res.status(404).json({ success: false, message: "Produit non trouvé" });
    }
    return res.status(200).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.getProductByF = async function (req, res) {
try{
  const validationResult = validateProductSearch(req.query);
    if (!validationResult.isValid) {
      return res.status(400).json({success: false, message: validationResult.errors});
    }
const {name,unit,Maxprice,MinPrice}=req.query;
 const filter = {};
 if (name) filter.name = name;
 if (unit) filter.unit = unit;
 if (Maxprice) filter.selling_price = { $lte: Maxprice };
 if (MinPrice) filter.selling_price = { $gte: MinPrice };
 const products = await productModel.find(filter).populate('supplier').populate('categories');
 if (products.length === 0) {
   return res.status(404).json({ success: false, message: "aucun produit trouvé" });
 }
 return res.status(200).json({ success: true, products });

}catch(error){
  res.status(500).json({ message: error.message });
}
}
  