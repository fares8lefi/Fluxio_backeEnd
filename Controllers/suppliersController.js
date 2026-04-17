const supplierModel = require("../models/suppliersModel");
const { validateSupplierRegistration, validateSupplierUpdate } = require('../validations/SuppliersValidations');

module.exports.addSuppliers = async function (req, res) {
  try {
    const validationResult = validateSupplierRegistration(req.body);
    if (!validationResult.isValid) {
      return res.status(400).json({success: false, message: validationResult.errors});
    }
    const { name, code, email, phone, address } = req.body;
    const suppliers = await supplierModel.create({
      name,
      code,
      email,
      phone,
      address,
    });
    res.status(201).json({ success: true, suppliers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.updateSuppliers = async function (req, res) {
  try {
    const validationResult = validateSupplierUpdate(req.body);
    if (!validationResult.isValid) {
      return res.status(400).json({success: false, message: validationResult.errors});
    }
    const { name, code, email, phone, address } = req.body;
    const id = req.params.id;
    const verifId = await supplierModel.findById(id);
    if (!verifId) {
      return res.status(404).json({ success: false, message: "suppliers not found" });
    }
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (code !== undefined) updates.code = code;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;

    const suppliers = await supplierModel.findByIdAndUpdate(id, updates, { new: true });
    res.status(200).json({ success: true, supplier: suppliers });
  } catch (error) {
    console.log("error==>", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports.deleteSuppliers = async function (req, res) {
  try {
    const id = req.params.id;

    const verifId = await supplierModel.findById(id);

    if (!verifId) {
      return res.status(404).json({ success: false, message: "suppliers not found" });
    }
    await supplierModel.findByIdAndDelete(id);
    res
      .status(200)
      .json({ success: true, message: "suppliers delete successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


module.exports.getActiveSuppliers = async function(req, res) {
  try {
    const suppliers = await supplierModel.find({ is_active: true });
    if (suppliers.length === 0) {
      return res.status(404).json({ success: false, message: "no active suppliers found" });
    }
    res.status(200).json({ success: true, suppliers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

module.exports.updateSuppliersStatus = async function(req, res) {
  try {
    const id = req.params.id;
    const suppliers = await supplierModel.findById(id);
    if (!suppliers) {
      return res.status(404).json({ success: false, message: "suppliers not found" });
    }
    await supplierModel.findByIdAndUpdate(id, {
      is_active: false
    });
    res.status(200).json({ success: true, message: "suppliers are inactive" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}



module.exports.serachSuppliersbyName = async function(req, res) {
  try {
      const { name } = req.body; 

      if (!name) {
        return res.status(400).json({ success: false, message: "Name is required" });
      }

      const suppliers = await supplierModel.find({ name }); 

      if (!suppliers || suppliers.length === 0) {
        return res.status(404).json({ success: false, message: "Suppliers not found" });
      }

      res.status(200).json({ success: true, suppliers });

  } catch (error) {
      console.log("error ===>", error);
      res.status(500).json({ success: false, message: error.message });
  }
}

module.exports.getAllSuppliers = async function(req, res) {
  try {
    const suppliers = await supplierModel.find();
    if (suppliers.length === 0) {
      return res.status(404).json({ success: false, message: "no suppliers found" });
    }
    res.status(200).json({ success: true, suppliers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

