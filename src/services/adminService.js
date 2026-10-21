const adminRepository = require('../repositories/adminRepository');
const userRepository = require('../repositories/userRepository');
const { newOtpFields } = require('./userService');
const { sendAdminVerificationCode } = require('./SendEmail');
const { validateAdminCreation } = require('../validations/UserValidations');

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
    const err = new Error(
      'Aucun champ valide à mettre à jour (name, address, phone, matriculeFiscale)'
    );
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

/**
 * Créer un compte administrateur (réservé aux admins).
 * Sans entreprise ; le compte reste inactif jusqu'à la saisie du code OTP envoyé par
 * email (PUT /api/users/verifyAccounts). L'inscription publique ne peut jamais attribuer
 * le rôle admin : c'est le seul moyen d'en créer un par l'API.
 */
const createAdmin = async (data = {}, createdBy) => {
  const { errors, isValid } = validateAdminCreation(data);
  if (!isValid) {
    const err = new Error('Validation échouée');
    err.statusCode = 400;
    err.details = errors;
    throw err;
  }

  const email = data.email.trim().toLowerCase();
  if (await userRepository.findOneByEmail(email)) {
    const err = new Error('Un compte avec cet email existe déjà.');
    err.statusCode = 409;
    throw err;
  }

  const otp = newOtpFields();
  let admin;
  try {
    admin = await userRepository.create({
      username: data.username.trim(),
      email,
      password: data.password,
      phone: data.phone ? data.phone.trim() : null,
      ...otp,
      role: 'admin',
      is_active: false,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      const field = error.meta?.target?.includes?.('username') ? 'username' : 'phone';
      const err = new Error(
        field === 'username'
          ? "Ce nom d'utilisateur est déjà pris"
          : 'Ce téléphone est déjà utilisé'
      );
      err.statusCode = 409;
      err.details = { [field]: 'Déjà utilisé' };
      throw err;
    }
    throw error;
  }

  // Envoyé après la création : pas d'email pour un compte refusé (doublon)
  await sendAdminVerificationCode(email, admin.username, otp.code, createdBy?.username);

  return {
    id: admin.id,
    username: admin.username,
    email: admin.email,
    phone: admin.phone,
    role: admin.role,
    is_active: admin.is_active,
    created_at: admin.created_at,
  };
};

module.exports = {
  getPlatformStats,
  getAllCompanies,
  getCompanyDetails,
  updateCompanyGeneralInfo,
  toggleCompanyStatus,
  toggleUserStatus,
  createAdmin,
};
