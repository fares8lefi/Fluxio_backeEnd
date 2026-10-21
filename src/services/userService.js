// Logique métier des utilisateurs — toutes les opérations Mongoose remplacées par le repository Prisma.
const userRepository = require('../repositories/userRepository');
const companyRepository = require('../repositories/companyRepository');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
  sendEmailVerificationCode,
  sendAdminVerificationCode,
  sendEmailResetCode,
} = require('./SendEmail');
const {
  validateUserRegistration,
  validateUserUpdate,
  validatePassword,
  validateLogin,
} = require('../validations/UserValidations');

const maxTime = 240 * 60 * 60;

/**
 * Utilisateur tel qu'exposé au frontend (connexion et /me) : même forme partout,
 * avec le nom de l'entreprise et le rôle dans l'entreprise.
 */
const toPublicUser = (user, companyName) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  phone: user.phone ?? null,
  role: user.role,
  company_role: user.company_role ?? 'OWNER',
  companyId: user.companyId ?? null,
  company_name: companyName ?? user.company?.name ?? null,
  status: user.is_active,
  email_verified: user.email_verified,
});

// ── Codes OTP ────────────────────────────────────────────────────────────
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

/** Code à 6 chiffres, tiré par un générateur cryptographique */
const generateOtp = () => crypto.randomInt(100000, 1000000);

/** Champs à enregistrer pour un nouveau code (compteur d'essais remis à zéro) */
const newOtpFields = () => ({
  code: generateOtp(),
  code_expires_at: new Date(Date.now() + OTP_TTL_MS),
  code_attempts: 0,
});

const otpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * Vérifie un code OTP. Chaque échec est compté ; au 5e, le code est invalidé et
 * il faut en redemander un — 6 chiffres + 5 essais rendent la force brute vaine.
 */
const checkOtp = async (user, code) => {
  if (!user.code || (user.code_expires_at && new Date() > new Date(user.code_expires_at))) {
    throw otpError('Code expiré. Veuillez en demander un nouveau.', 400);
  }
  if ((user.code_attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    throw otpError('Trop de tentatives. Veuillez demander un nouveau code.', 429);
  }
  if (String(user.code) !== String(code).trim()) {
    const attempts = (user.code_attempts ?? 0) + 1;
    const exhausted = attempts >= OTP_MAX_ATTEMPTS;
    await userRepository.update(user.id, {
      code_attempts: attempts,
      ...(exhausted && { code: null, code_expires_at: null }),
    });
    throw exhausted
      ? otpError('Trop de tentatives. Veuillez demander un nouveau code.', 429)
      : otpError(`Code invalide — ${OTP_MAX_ATTEMPTS - attempts} essai(s) restant(s)`, 400);
  }
};

const createAccessToken = (id) => {
  const expiry = process.env.ACCESS_TOKEN_EXPIRY || '15m';
  return jwt.sign({ id }, process.env.net_Secret, { expiresIn: expiry });
};

const createRefreshToken = (id) => {
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET || process.env.net_Secret + '_refresh';
  const expiry = process.env.REFRESH_TOKEN_EXPIRY || '10d';
  return jwt.sign({ id }, refreshSecret, { expiresIn: expiry });
};

const createUser = async (data) => {
  const { errors, isValid } = validateUserRegistration(data);
  if (!isValid) {
    const error = new Error('Validation échouée');
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }

  const { username, password, phone, email, company_name, matriculeFiscale } = data;

  const existingUser = await userRepository.findOneByEmail(email);
  if (existingUser) {
    const error = new Error('Un compte avec cet email existe déjà.');
    error.statusCode = 409;
    throw error;
  }

  // Le code OTP expire dans 10 minutes
  const otp = newOtpFields();

  const company = await companyRepository.create({ name: company_name, matriculeFiscale });

  await Promise.all([
    userRepository.create({
      username,
      email,
      password,
      phone,
      ...otp,
      is_active: false,
      // Jamais de rôle admin à l'inscription : créé uniquement côté base / script
      role: 'user',
      companyId: company.id,
    }),
    sendEmailVerificationCode(email, username, otp.code),
  ]);
};

/** Un compte déjà vérifié n'a rien à activer : s'il est inactif, il a été suspendu */
const alreadyVerified = () => {
  const error = new Error('Ce compte est déjà vérifié.');
  error.statusCode = 409;
  return error;
};

const verifyAccounts = async (email, code) => {
  // findOneByEmail returns user without password — we need the full user with code
  const user = await userRepository.findOneByEmailWithPassword(email);
  if (!user) {
    const error = new Error('Utilisateur introuvable');
    error.statusCode = 404;
    throw error;
  }
  if (user.email_verified) throw alreadyVerified();

  await checkOtp(user, code);

  await userRepository.update(user.id, {
    is_active: true,
    email_verified: true,
    code: null,
    code_expires_at: null,
    code_attempts: 0,
  });
};

const resendCode = async (email) => {
  const user = await userRepository.findOneByEmailWithPassword(email);
  if (!user) {
    const error = new Error('Utilisateur introuvable');
    error.statusCode = 404;
    throw error;
  }
  if (user.email_verified) throw alreadyVerified();

  const otp = newOtpFields();
  await userRepository.update(user.id, otp);

  // Un administrateur reçoit le gabarit « console », comme à sa création
  const send = user.role === 'admin' ? sendAdminVerificationCode : sendEmailVerificationCode;
  await send(email, user.username, otp.code);
};

/**
 * Étape 1 — Initier la réinitialisation du mot de passe :
 * Génère un code OTP et l'envoie par email.
 */
const forgetPassword = async (email) => {
  const user = await userRepository.findOneByEmailWithPassword(email);
  if (!user) {
    // Par sécurité on ne révèle pas si l'email existe ou non
    return;
  }

  const otp = newOtpFields();
  await userRepository.update(user.id, otp);

  await sendEmailResetCode(email, user.username, otp.code);
};

/**
 * Étape 2 — Vérifier le code OTP et définir le nouveau mot de passe.
 */
const forgetPasswordVerifyCode = async (email, code, newPassword) => {
  const { errors, isValid } = validatePassword(newPassword);
  if (!isValid) {
    const error = new Error('Validation échouée');
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }

  const user = await userRepository.findOneByEmailWithPassword(email);
  if (!user) {
    const error = new Error('Utilisateur introuvable');
    error.statusCode = 404;
    throw error;
  }

  await checkOtp(user, code);

  const salt = await bcrypt.genSalt();
  const hashedPassword = await bcrypt.hash(newPassword, salt);
  // Invalider le code après utilisation
  await userRepository.update(user.id, {
    password: hashedPassword,
    code: null,
    code_expires_at: null,
    code_attempts: 0,
  });
};

const loginUser = async (data) => {
  const { errors, isValid } = validateLogin(data);
  if (!isValid) {
    const error = new Error('Validation échouée');
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }

  const { email, password } = data;

  // Get full user including password for bcrypt compare
  // Same 401 + message for unknown email and wrong password: avoids
  // revealing which emails have an account (user enumeration)
  const invalidCredentials = () => {
    const error = new Error('Email ou mot de passe incorrect');
    error.statusCode = 401;
    return error;
  };

  const user = await userRepository.findOneByEmailWithPassword(email);
  if (!user) throw invalidCredentials();

  const auth = await bcrypt.compare(password, user.password);
  if (!auth) throw invalidCredentials();

  const accessToken = createAccessToken(user.id);
  const refreshToken = createRefreshToken(user.id);

  // Save refresh token in DB along with last login time
  await userRepository.update(user.id, {
    last_login: new Date(),
    refreshToken: refreshToken,
  });

  const userCompany = user.companyId ? await companyRepository.findById(user.companyId) : null;
  return {
    user: {
      ...toPublicUser(user, userCompany?.name),
      companyName: userCompany?.name || null, // compatibilité
    },
    token: accessToken, // Backward compatibility
    accessToken,
    refreshToken,
    maxTime,
  };
};

const getConnectedUser = async (id) => {
  if (!id) {
    const error = new Error('Utilisateur introuvable');
    error.statusCode = 404;
    throw error;
  }

  const user = await userRepository.findById(id);
  if (!user) {
    const error = new Error('Utilisateur introuvable');
    error.statusCode = 404;
    throw error;
  }

  return user;
};

const changePassword = async (id, currentPassword, newPassword) => {
  if (!id) {
    const error = new Error('Non authentifié');
    error.statusCode = 401;
    throw error;
  }

  const isValid = await userRepository.verifPasswordUser(id, currentPassword);
  if (!isValid) {
    const error = new Error('Mot de passe actuel incorrect');
    error.statusCode = 401;
    throw error;
  }

  const { errors, isValid: passwordValid } = validatePassword(newPassword);
  if (!passwordValid) {
    const error = new Error('Validation échouée');
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }

  const salt = await bcrypt.genSalt();
  const hashedPassword = await bcrypt.hash(newPassword, salt);
  await userRepository.update(id, { password: hashedPassword });
};

const updatePersonnelData = async (id, data, currentPassword) => {
  const { errors, isValid } = validateUserUpdate(data);
  if (!isValid) {
    const error = new Error('Validation échouée');
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }

  if (!id) {
    const error = new Error('Non authentifié');
    error.statusCode = 401;
    throw error;
  }

  const match = await userRepository.verifPasswordUser(id, currentPassword);
  if (!match) {
    const error = new Error('Mot de passe actuel incorrect');
    error.statusCode = 401;
    throw error;
  }

  const { username, email, phone } = data;
  const updates = {};
  if (username) updates.username = username;
  if (email) updates.email = email;
  if (phone) updates.phone = phone;

  if (Object.keys(updates).length > 0) {
    await userRepository.update(id, updates);
  }
};

const updateUserStatus = async (id) => {
  const user = await userRepository.findById(id);
  if (!user) {
    const error = new Error('Utilisateur introuvable');
    error.statusCode = 404;
    throw error;
  }
  await userRepository.update(id, { is_active: true });
};

const getAllUsers = async () => {
  return await userRepository.findAll();
};

const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    const error = new Error('Refresh token requis');
    error.statusCode = 401;
    throw error;
  }

  try {
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET || process.env.net_Secret + '_refresh';
    const decoded = jwt.verify(refreshToken, refreshSecret);

    // Find user by ID and check their stored refresh token
    const user = await userRepository.findByIdWithPassword(decoded.id);
    if (!user) {
      const error = new Error('Utilisateur introuvable');
      error.statusCode = 401;
      throw error;
    }

    if (!user.is_active) {
      const error = new Error('Compte non activé');
      error.statusCode = 403;
      throw error;
    }

    if (user.refreshToken !== refreshToken) {
      const error = new Error('Refresh token invalide ou expiré');
      error.statusCode = 401;
      throw error;
    }

    // Generate new tokens (token rotation)
    const newAccessToken = createAccessToken(user.id);
    const newRefreshToken = createRefreshToken(user.id);

    // Update database with the new refresh token
    await userRepository.update(user.id, { refreshToken: newRefreshToken });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: { id: user.id, email: user.email, role: user.role, status: user.is_active },
    };
  } catch (err) {
    console.error('Refresh token error:', err);
    const error = new Error('Refresh token invalide ou expiré');
    error.statusCode = 401;
    throw error;
  }
};

const logoutUser = async (id) => {
  if (id) {
    await userRepository.update(id, { refreshToken: null });
  }
};

const deleteUser = async (targetId, requesterId) => {
  if (targetId === requesterId) {
    const error = new Error('Vous ne pouvez pas supprimer votre propre compte');
    error.statusCode = 403;
    throw error;
  }
  const user = await userRepository.findById(targetId);
  if (!user) {
    const error = new Error('Utilisateur introuvable');
    error.statusCode = 404;
    throw error;
  }
  await userRepository.deleteById(targetId);
};

module.exports = {
  newOtpFields,
  createUser,
  verifyAccounts,
  resendCode,
  forgetPassword,
  forgetPasswordVerifyCode,
  loginUser,
  toPublicUser,
  getConnectedUser,
  changePassword,
  updatePersonnelData,
  updateUserStatus,
  getAllUsers,
  deleteUser,
  createAccessToken,
  createRefreshToken,
  refreshAccessToken,
  logoutUser,
};
