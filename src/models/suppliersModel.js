const mongoose = require("mongoose");

const supplierModel = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  code: {
    type: Number,
    unique: true,
  },
  email: {
    type: String,
    unique: true,
    match: [
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      "L'adresse e-mail doit être valide ex: exemple@domaine.com .",
    ],
  },
  phone: {
    type: Number,

    unique: true,
    required: true,
  },
  address: {
    type: String,
  },
  is_active: {
    type: Boolean,
    default: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

const Suppliers = mongoose.model("Suppliers", supplierModel);

module.exports = Suppliers;
