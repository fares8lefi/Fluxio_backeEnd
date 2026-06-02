const userService = require('../services/userService');

module.exports.createUser = async (req, res) => {
    try {
        await userService.createUser(req.body);
        return res.status(200).json({ message: "code has been sent to your email", success: true });
    } catch (error) {
        console.error(error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ 
            success: false, 
            message: error.message,
            ...(error.details && { errors: error.details })
        });
    }
};

module.exports.verifyAccounts = async (req, res) => {
    try {
        const { email, code } = req.body;
        await userService.verifyAccounts(email, code);
        return res.status(200).json({ message: "user verified successfully", success: true });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

module.exports.resendCode = async (req, res) => {
    try {
        const { email } = req.body;
        await userService.resendCode(email);
        return res.status(200).json({ message: "code has been sent to your email", success: true });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

module.exports.foorgetPasswordVerifyCode = async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        await userService.forgetPasswordVerifyCode(email, newPassword);
        return res.status(200).json({ message: "password has been changed successfully", success: true });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ 
            success: false, 
            message: error.message,
            ...(error.details && { errors: error.details }) 
        });
    }
};

module.exports.loginUser = async (req, res) => {
    try {
        const result = await userService.loginUser(req.body);
        
        res.cookie("jwt_login", result.token, {
            httpOnly: true,
            maxAge: result.maxTime,
        });
        
        return res.status(200).json({
            success: true,
            user: result.user,
            token: result.token,
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ 
            success: false, 
            message: error.message,
            ...(error.details && { errors: error.details })
        });
    }
};

module.exports.getConnectedUser = async (req, res) => {
    try {
        const id = req.session.user?._id;
        const user = await userService.getConnectedUser(id);
        return res.status(200).json({ success: true, user });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

module.exports.logOutUser = async (req, res) => {
    try {
        res.cookie("jwt_login", "", {
            maxAge: 1,
            httpOnly: true,
        });
        return res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports.changePassword = async (req, res) => {
    try {
        const { currentPassord, newPassword } = req.body;
        const id = req.session.user?._id || req.user?._id;
        
        await userService.changePassword(id, currentPassord, newPassword);
        return res.status(200).json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ 
            success: false, 
            message: error.message,
            ...(error.details && { errors: error.details }) 
        });
    }
};

module.exports.updatePersonnelData = async (req, res) => {
    try {
        const { password, ...data } = req.body;
        const id = req.session?.user?._id || req.user?._id;
        
        await userService.updatePersonnelData(id, data, password);
        return res.status(200).json({ success: true, message: 'success' });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ 
            success: false, 
            message: error.message,
            ...(error.details && { errors: error.details })
        });
    }
};

module.exports.updateUserStatus = async (req, res) => {
    try {
        const id = req.session?.user?._id || req.user?._id;
        await userService.updateUserStatus(id);
        return res.status(200).json({ success: true, message: "user updated" });
    } catch (error) {
        console.error("error", error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({ success: false, message: error.message });
    }
};

module.exports.getAllUsers = async (req, res) => {
    try {
        const users = await userService.getAllUsers();
        return res.status(200).json({ success: true, users });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};