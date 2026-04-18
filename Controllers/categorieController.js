const categorieModel = require('../models/categorieModel')
const { validateCategorieRegistration, validateCategorieUpdate } = require('../validations/CategorieValidations');
module.exports.createcategory = async function(req, res) {
    try {
        const validationResult = validateCategorieRegistration(req.body);
        if (!validationResult.isValid) {
            return res.status(400).json({success: false, message: validationResult.errors});
        }
        const {name, code ,description} = req.body;
        const existingCategory = await categorieModel.verifNameCode(code, name);
        if (existingCategory) {
            return res.status(400).json({success: false, message: "categorie existe"});
        }
        const categories = await categorieModel.create({name, code ,description});
        res.status(200).json({success: true, categories});
    }catch(error){
        console.log(error)
      res.status(500).json({ message: error.message });
    }
}

module.exports.getAllCategories = async function(_req,res){
    try{
        const categories = await  categorieModel.find();
        res.status(200).json({categories });
        
    }catch(error){
        res.status(500).json({ message: error.message });
    }
}

module.exports.updateCategorie = async function(req, res) {
    try {
        const validationResult = validateCategorieUpdate(req.body);
        if (!validationResult.isValid) {
            return res.status(400).json({ success: false, message: validationResult.errors });
        }
        
        const { name, code, description } = req.body;
        const id = req.params.id;
        
        if (!id) {
            return res.status(400).json({ success: false, message: "id non valid" });
        }
        
        const categorie = await categorieModel.findById(id);
        if (!categorie) {
            return res.status(404).json({ success: false, message: "categorie not found" });
        }

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (code !== undefined) updates.code = code;
        if (description !== undefined) updates.description = description;

        const update = await categorieModel.findByIdAndUpdate(id, updates, { new: true });
        
        res.status(200).json({ success: true, message: "categorie updated successfully", categorie: update });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports.deleteCategorie = async function (req, res) {
    try {
        const id = req.params.id; 

        const categorie = await categorieModel.findById(id);

        if (!categorie) {
            return res.status(400).json({ message: "categorie not found" });
        }

        await categorieModel.findByIdAndDelete(id);

        res.status(200).json({ message: "categorie deleted successfully" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

