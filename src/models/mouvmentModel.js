const mongoose = require('mongoose');

const mouvmentSchema = new mongoose.Schema({

  type: {
    type: String,
    enum: ['IN', 'OUT', 'RETURN_SUPPLIER', 'RETURN_CLIENT'],
    required: true,
  },

  items: {
    type: [{
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
      unit: {
        type: Number,
        required: true,
        min: 1,
      },
      unit_price: {
        type: Number,
        default: null,
      }
    }],
    validate: v => v.length > 0,
    required: true,
  },

  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Suppliers',
    default: null,
    required: true, 
  },

  

  reference: {
    type: String,
    trim: true,
    default: null,
  },

  note: {
    type: String,
    trim: true,
    default: null,
  },

 
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'CANCELLED'],
    default: 'CONFIRMED',
  },

  created_at: {
    type: Date,
    default: Date.now,
  },

});

module.exports = mongoose.model('Mouvment', mouvmentSchema);