var express = require('express');
var router = express.Router();

const userController=require('../Controllers/userController')
const {requireAuthUser}= require("../middlewares/authMiddelwares");

const {isAdmin}= require("../middlewares/isAdminMiddelware");
/* GET users listing. */
//post
router.post('/createUser',userController.createUser)
router.post('/loginUser',userController.loginUser)
router.post('/logOutUser', requireAuthUser, userController.logOutUser);
router.post('/changePassword',requireAuthUser,userController.changePassword)
router.post('/resendCode',userController.resendCode)

//put
router.put('/updatePersonnelData',requireAuthUser,userController.updatePersonnelData)
router.put('/updateUserStatus',requireAuthUser,userController.updateUserStatus)
router.put('/foorgetPasswordVerifyCode',userController.foorgetPasswordVerifyCode)
router.put('/verifyAccounts',userController.verifyAccounts)


//get
router.get('/getAllUsers',requireAuthUser,isAdmin,userController.getAllUsers)
router.get('/getConnectedUser',requireAuthUser,isAdmin,userController.getConnectedUser)
module.exports = router;
