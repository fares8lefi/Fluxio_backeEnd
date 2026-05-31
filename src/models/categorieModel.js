const mongoose = require('mongoose')


const categorieSchema = new mongoose.Schema({
    name :{
        type : String,
        required : true,   
        unique : true    
    },
     code :{
        type : Number,
        required : true,   
        unique : true  
    },
     description :{
        type : String,   
    },
    is_active: {
        type: Boolean,
        default : true
    },
    created_at : {
        type : Date,
        default : Date.now,
    }

    })
    
categorieSchema.statics.verifNameCode = async function (code,name) {
    const existName = await this.findOne({name :name});
    const exisCode = await this.findOne({code :code});
    if(existName||exisCode){
        return true;
    }
    return false;    
};


const Categorie = mongoose.model('Categorie', categorieSchema);

module.exports = Categorie;