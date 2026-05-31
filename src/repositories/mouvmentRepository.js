const Mouvment = require('../models/mouvmentModel');

// Crée un nouveau mouvement
const create = async (data) => {
    return await Mouvment.create(data);
};

// Récupère les mouvements avec pagination
const findPaginated = async (page, limit) => {
    return await Mouvment.find()
        .skip((page - 1) * limit)
        .limit(limit);
};

// Compte le nombre total de mouvements
const countAll = async () => {
    return await Mouvment.countDocuments();
};

module.exports = {
    create,
    findPaginated,
    countAll,
};