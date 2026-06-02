const User = require('../models/userModel');

const create = async (data) => {
    return await User.create(data);
};

const findOneByEmail = async (email) => {
    return await User.findOne({ email }).select('-password');
};

const findById = async (id) => {
    return await User.findById(id).select('-password');
};

const update = async (id, updates) => {
    return await User.findByIdAndUpdate(id, updates, { new: true });
};

const findAll = async () => {
    return await User.find().select('-password -code');
};

module.exports = {
    create,
    findOneByEmail,
    findById,
    update,
    findAll
};
