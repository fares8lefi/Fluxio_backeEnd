const adminRepository = require('../repositories/adminRepository');

/**
 * Stats globales de la plateforme
 */
const getPlatformStats = async () => {
  return adminRepository.getPlatformStats();
};

/**
 * Liste paginée des entreprises
 */
const getAllCompanies = async ({ page, limit, search }) => {
  return adminRepository.findAllCompanies({ page, limit, search });
};

/**
 * Détail d'une entreprise
 */
const getCompanyDetails = async (id) => {
  const company = await adminRepository.findCompanyById(id);
  if (!company) {
    const err = new Error('Entreprise introuvable');
    err.statusCode = 404;
    throw err;
  }
  return company;
};

/**
 * Modifier les données générales d'une entreprise (admin uniquement)
 * Seuls name, address, phone, matriculeFiscale sont autorisés — pas les données de stock
 */
const updateCompanyGeneralInfo = async (id, rawData) => {
  await getCompanyDetails(id); // vérifier l'existence

  // Whitelist stricte : seuls ces champs sont modifiables par l'admin
  const allowedFields = ['name', 'address', 'phone', 'matriculeFiscale'];
  const data = {};
  for (const field of allowedFields) {
    if (rawData[field] !== undefined) {
      data[field] = rawData[field];
    }
  }

  if (Object.keys(data).length === 0) {
    const err = new Error('Aucun champ valide à mettre à jour (name, address, phone, matriculeFiscale)');
    err.statusCode = 400;
    throw err;
  }

  return adminRepository.updateCompanyGeneralInfo(id, data);
};

/**
 * Activer ou suspendre une entreprise
 */
const toggleCompanyStatus = async (id, is_active) => {
  await getCompanyDetails(id); // vérifier l'existence
  return adminRepository.updateCompanyStatus(id, is_active);
};

/**
 * Activer ou suspendre un utilisateur
 */
const toggleUserStatus = async (id, is_active) => {
  return adminRepository.updateUserActiveStatus(id, is_active);
};

module.exports = {
  getPlatformStats,
  getAllCompanies,
  getCompanyDetails,
  updateCompanyGeneralInfo,
  toggleCompanyStatus,
  toggleUserStatus,
};
