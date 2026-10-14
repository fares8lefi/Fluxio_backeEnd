const companyRepository = require('../repositories/companyRepository');

// Matricule fiscal tunisien : 7 chiffres + clé, puis code TVA / catégorie /
// n° d'établissement — ex. 1234567A/A/M/000 (les « / » sont parfois omis)
const MF_PATTERN = /^\d{7}[A-Z]\/?[A-Z]\/?[A-Z]\/?\d{3}$/;

const httpError = (message, statusCode, details) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (details) err.details = details;
  return err;
};

/** Normalise un MF saisi : majuscules, sans espaces */
const normalizeMatricule = (mf) => String(mf).replace(/\s/g, '').toUpperCase();

const getMyCompany = async (companyId) => {
  if (!companyId) throw new Error('companyId manquant');
  const company = await companyRepository.findById(companyId);
  if (!company) throw httpError('Entreprise introuvable', 404);
  return company;
};

/**
 * Met à jour les informations légales de l'entreprise (mentions obligatoires
 * des factures, art. 18 du Code de la TVA).
 */
const updateMyCompany = async (companyId, data = {}) => {
  if (!companyId) throw new Error('companyId manquant');

  const updates = {};
  const errors = {};
  const text = (v) => (typeof v === 'string' ? v.trim() : v);

  if (data.name !== undefined) {
    const name = text(data.name);
    if (!name) errors.name = 'La raison sociale est obligatoire';
    else updates.name = name;
  }
  if (data.matriculeFiscale !== undefined) {
    const mf = normalizeMatricule(text(data.matriculeFiscale) ?? '');
    if (!MF_PATTERN.test(mf)) {
      errors.matriculeFiscale = 'Format attendu : 1234567A/A/M/000';
    } else {
      updates.matriculeFiscale = mf;
    }
  }
  if (data.address !== undefined) updates.address = text(data.address) || null;
  if (data.phone !== undefined) {
    const phone = text(data.phone);
    if (phone && !/^[+\d][\d\s.-]{6,19}$/.test(phone))
      errors.phone = 'Numéro de téléphone invalide';
    else updates.phone = phone || null;
  }

  if (Object.keys(errors).length > 0) throw httpError('Données entreprise invalides', 400, errors);
  if (Object.keys(updates).length === 0) throw httpError('Aucune donnée à mettre à jour', 400);

  return await companyRepository.update(companyId, updates);
};

module.exports = {
  getMyCompany,
  updateMyCompany,
  MF_PATTERN,
  normalizeMatricule,
};
