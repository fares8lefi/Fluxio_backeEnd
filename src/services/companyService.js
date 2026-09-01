const companyRepository = require('../repositories/companyRepository');

const getMyCompany = async (companyId) => {
    if (!companyId) throw new Error("companyId manquant");
    const company = await companyRepository.findById(companyId);
    if (!company) {
        const err = new Error("Entreprise introuvable");
        err.statusCode = 404;
        throw err;
    }
    return company;
};

const updateMyCompany = async (companyId, data) => {
    if (!companyId) throw new Error("companyId manquant");
    
    const updates = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.matriculeFiscale !== undefined) updates.matriculeFiscale = data.matriculeFiscale;
    if (data.address !== undefined) updates.address = data.address;
    if (data.phone !== undefined) updates.phone = data.phone;
    
    if (Object.keys(updates).length === 0) {
        throw new Error("Aucune donnée à mettre à jour");
    }

    return await companyRepository.update(companyId, updates);
};

module.exports = {
    getMyCompany,
    updateMyCompany,
};
