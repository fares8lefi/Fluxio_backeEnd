const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  code: {
    type: Number,
    unique: true,
    required: true,
  },
  barcode: {
    type: Number,
    unique: true,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  purchase_price: {
    type: Number,
    required: true,
  },
  selling_price: {
    type: Number,
    required: true,
  },
  unit: {
    type: Number,
    required: true,
  },
  stock_min: {
    type: Number,
    required: true,
  },
  // Relation vers un fournisseur (one supplier)
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Suppliers',
    required: false, 
  },
  // Relations vers une ou plusieurs catégories
  categories: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Categorie',
    },
  ],
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
