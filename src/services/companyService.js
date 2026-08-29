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
    if (!data.name) {
        const err = new Error("Le nom de l'entreprise est requis");
        err.statusCode = 400;
        throw err;
    }
    return await companyRepository.update(companyId, { name: data.name });
};

module.exports = {
    getMyCompany,
    updateMyCompany,
};
