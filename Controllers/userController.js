const userModel = require('../models/userModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const {sendEmailVerificationCode,sendEmailResetCode}=require('../services/SendEmail');
const maxTime = 240 * 60 * 60;
const createToken = (id) => {
    
    const expiresIn =maxTime;
    return jwt.sign({ id }, process.env.net_Secret, { expiresIn });
};
module.exports.createUser =async(req,res) =>{
    try{
            const missing =["username","password","phone","email"].find(key => !req.body[key])
            if(missing){
                return res.status(400).json({message:`missing field :${missing}`})
            }
            const {username,password,phone,email}=req.body;
            const code = Math.floor(1000 + Math.random() * 9000);
            await sendEmailVerificationCode(email, username, code);
            await userModel.create(
                {
                    username,
                    email,
                    password,
                    phone,
                    code,
                    is_active: false,
                }
            )
         res.status(200).json({message :"code has been sent to your email" ,success:true})   
    }catch(err){
        console.log(err);
        res.status(500).json({error:err.message})
    }
}

module.exports.loginUser=async(req, res)=>{
   try{ 
    
    const {email,password}=req.body;
    const user =await userModel.login(email,password);
    const token = createToken(user._id);
             
             res.cookie("jwt_login", token, {
            httpOnly: true,
            maxAge: maxTime,
        });
    
    await userModel.findByIdAndUpdate(user._id, { last_login: new Date() });
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      token, 
    })
  } catch (error) {
    res.status(500).json({message: error.message})
  }
}


module.exports.getConnectedUser = async (req, res) => {
    try {
       
        const id = req.session.user?._id;
        
        if (!id) {
            return res.status(404).json({ message: "user not found" });
        }
        
        const user = await userModel.findById(id);
        
        if (!user) {
            return res.status(404).json({ message: "user not found" });
        }
        
        res.status(200).json({ user });
    } catch (error) {
        
        res.status(500).json({ message: error.message });
    }
}

module.exports.logOutUser = async (res) => {
    try {
        res.cookie("jwt_login", "", {
            maxAge: 1,
            httpOnly: true,
        });
        res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports.changePassword = async (req,res)=>{
    try{
        const {currentPassord, newPassword} = req.body;
        const id = req.session.user?._id;
        console.log(id)
        const change = await userModel.verifPasswordUser(id, currentPassord)
        console.log(change)
        if (change) {
          const salt = await bcrypt.genSalt();
          
          const hashedPassword = await bcrypt.hash(newPassword, salt)
          const update = await userModel.findByIdAndUpdate(id, {
            password: hashedPassword
          })
          return res.status(200).json({
            success: true,
            message: "Password updated successfully"
            });
        }
       
    }catch(error){
        
        res.status(500).json({ message: error.message });
    }
}

module.exports.updatePersonnelData = async function(req ,res){
    try{
        const {username , email, phone , password}= req.body
    
        const id = req.session?.user?._id || req.user?._id;

        if (!id) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const match = await userModel.verifPasswordUser(id, password);
        if (match) {
            
            const updates = {};
            if (username) updates.username = username;
            if (email) updates.email = email;
            if (phone) updates.phone = phone;

            if (Object.keys(updates).length > 0) {
                await userModel.findByIdAndUpdate(id, updates, { new: true });
            }

            return res.status(200).json({ message: 'success' });
        }

        return res.status(401).json({ message: 'Current password incorrect' });
    }catch(error){
        res.status(500).send({ message: error.message });
    }
}

module.exports.updateUserStatus= async function (req , res){
    try{

        const id = req.session?.user?._id || req.user?._id;
        const user=await userModel.findById(id);
        if(!user){
            res.status(500).json({success: false,message:"user not found"})
        }
      await userModel.findByIdAndUpdate(
    id,
    { is_active: true },
    { new: true } 
);
        res.status(200).json({success: true,message:"user updated"})
    }catch(error){
        console.log("error",error)
        res.status(500).json({ message: error.message });
    }

}

module.exports.getAllUsers =async function (req , res) {
    try{
        const users = await userModel.find().select("-password");
        res.status(200).json({success: true,users})
    }catch(error){
        res.status(500).json({success: false, message: error.message})
    }  
}