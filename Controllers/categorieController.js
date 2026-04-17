const categorieModel = require('../models/categorieModel')
const { validateCategorieRegistration, validateCategorieUpdate } = require('../validations/CategorieValidations');
module.exports.createcategory = async function(req, res) {
    try {
        const validationResult = validateCategorieRegistration(req.body);
        if (!validationResult.isValid) {
            return res.status(400).json({success: false, message: validationResult.errors});
        }
        const {name, code} = req.body;
        const existingCategory = await categorieModel.verifNameCode(code, name);
        if (existingCategory) {
            return res.status(400).json({success: false, message: "categorie existe"});
        }
        const categories = await categorieModel.create({name, code});
        res.status(200).json({success: true, categories});
    }catch(error){
        console.log(error)
      res.status(500).json({ message: error.message });
    }
}

module.exports.getAllCategories = async function(res){
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
            return res.status(400).json({success: false, message: validationResult.errors});
        }   
        const {id, name, code} = req.body;
        
        if (!id) {
            return res.status(400).json({success: false, message: "id non valid"});
        }
        
        const categorie = await categorieModel.findById(id);
        if (!categorie) {
            return res.status(404).json({success: false, message: "categorie not found"});
        }
        
        const update = await categorieModel.findByIdAndUpdate(id, {
            name,
            code
        }, {new: true});
        
        res.status(200).json({success: true, message: "categorie updated successfully", categorie: update});
    }catch(error){
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

