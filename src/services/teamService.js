const crypto = require('crypto');
const prisma = require('../../config/db');
const userRepository = require('../repositories/userRepository');
const { validatePassword } = require('../validations/UserValidations');
const { sendInvitationEmail } = require('./SendEmail');

const ROLES = ['OWNER', 'STOCK', 'ACCOUNTANT'];
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const httpError = (message, statusCode, details) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (details) err.details = details;
  return err;
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const normalizeEmail = (email) =>
  String(email || '')
    .trim()
    .toLowerCase();
const frontendUrl = () =>
  (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].replace(/\/$/, '');

const MEMBER_SELECT = {
  id: true,
  username: true,
  email: true,
  phone: true,
  company_role: true,
  is_active: true,
  last_login: true,
  created_at: true,
};

/** Membres actifs de l'entreprise + invitations en attente */
const listTeam = async (companyId) => {
  const [members, invitations] = await Promise.all([
    prisma.user.findMany({
      where: { companyId },
      select: MEMBER_SELECT,
      orderBy: { created_at: 'asc' },
    }),
    prisma.invitation.findMany({
      where: { companyId, accepted_at: null, expires_at: { gt: new Date() } },
      select: { id: true, email: true, company_role: true, expires_at: true, created_at: true },
      orderBy: { created_at: 'desc' },
    }),
  ]);
  return { members, invitations };
};

/**
 * Invite un collaborateur. Le lien (jeton à usage unique, 7 jours) est envoyé par
 * e-mail et renvoyé au gérant pour qu'il puisse aussi le partager lui-même.
 */
const invite = async (inviter, { email, company_role } = {}) => {
  const normalized = normalizeEmail(email);
  const errors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) errors.email = 'Adresse e-mail invalide';
  if (!ROLES.includes(company_role)) errors.company_role = 'Rôle invalide';
  if (Object.keys(errors).length) throw httpError('Invitation invalide', 400, errors);

  if (await userRepository.findOneByEmail(normalized)) {
    throw httpError('Un compte Fluxio existe déjà avec cette adresse e-mail', 409, {
      email: 'Adresse déjà utilisée',
    });
  }

  // Une seule invitation active par adresse : la précédente est remplacée
  await prisma.invitation.deleteMany({
    where: { companyId: inviter.companyId, email: normalized, accepted_at: null },
  });

  const token = crypto.randomBytes(32).toString('hex');
  const invitation = await prisma.invitation.create({
    data: {
      email: normalized,
      company_role,
      token_hash: hashToken(token),
      expires_at: new Date(Date.now() + INVITE_TTL_MS),
      companyId: inviter.companyId,
      invitedById: inviter.id,
    },
    select: { id: true, email: true, company_role: true, expires_at: true },
  });

  const link = `${frontendUrl()}/#accept-invite?token=${token}`;
  const company = await prisma.company.findUnique({
    where: { id: inviter.companyId },
    select: { name: true },
  });
  const emailSent = await sendInvitationEmail(normalized, {
    companyName: company?.name ?? 'votre entreprise',
    inviterName: inviter.username,
    role: company_role,
    link,
  });

  return { invitation, link, email_sent: emailSent };
};

const findValidInvitation = async (token) => {
  if (!token || typeof token !== 'string') throw httpError("Lien d'invitation invalide", 400);
  const invitation = await prisma.invitation.findUnique({
    where: { token_hash: hashToken(token) },
    include: { company: { select: { name: true } } },
  });
  if (!invitation) throw httpError("Lien d'invitation invalide", 404);
  if (invitation.accepted_at) throw httpError('Cette invitation a déjà été utilisée', 410);
  if (invitation.expires_at < new Date())
    throw httpError('Cette invitation a expiré. Demandez-en une nouvelle.', 410);
  return invitation;
};

/** Informations affichées sur la page d'acceptation (sans authentification) */
const previewInvitation = async (token) => {
  const invitation = await findValidInvitation(token);
  return {
    email: invitation.email,
    company_role: invitation.company_role,
    company_name: invitation.company.name,
  };
};

/**
 * Crée le compte du collaborateur. Posséder le lien prouve la maîtrise de
 * l'adresse e-mail : le compte est actif immédiatement.
 */
const acceptInvitation = async ({ token, username, password, phone } = {}) => {
  const invitation = await findValidInvitation(token);

  const errors = {};
  const name = String(username || '').trim();
  if (name.length < 3) errors.username = "Le nom d'utilisateur doit contenir au moins 3 caractères";
  const pwd = validatePassword(password);
  if (!pwd.isValid)
    Object.assign(errors, { password: Object.values(pwd.errors)[0] || 'Mot de passe invalide' });
  if (Object.keys(errors).length) throw httpError('Données invalides', 400, errors);

  if (await userRepository.findOneByEmail(invitation.email)) {
    throw httpError('Un compte existe déjà avec cette adresse e-mail', 409);
  }

  try {
    const user = await userRepository.create({
      username: name,
      email: invitation.email,
      password,
      phone: phone ? String(phone).trim() : null,
      is_active: true,
      role: 'user',
      company_role: invitation.company_role,
      companyId: invitation.companyId,
    });
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { accepted_at: new Date() },
    });
    return { id: user.id, email: user.email, company_name: invitation.company.name };
  } catch (error) {
    if (error.code === 'P2002') {
      const field = error.meta?.target?.includes?.('username') ? 'username' : 'phone';
      throw httpError(
        field === 'username'
          ? "Ce nom d'utilisateur est déjà pris"
          : 'Ce téléphone est déjà utilisé',
        409,
        {
          [field]: 'Déjà utilisé',
        }
      );
    }
    throw error;
  }
};

const loadMember = async (companyId, userId) => {
  const member = await prisma.user.findFirst({
    where: { id: userId, companyId },
    select: MEMBER_SELECT,
  });
  if (!member) throw httpError('Membre introuvable', 404);
  return member;
};

const countOwners = (companyId) =>
  prisma.user.count({ where: { companyId, company_role: 'OWNER', is_active: true } });

/** Change le rôle d'un membre — l'entreprise garde toujours au moins un gérant */
const updateMemberRole = async (owner, userId, company_role) => {
  if (!ROLES.includes(company_role)) throw httpError('Rôle invalide', 400);
  const member = await loadMember(owner.companyId, userId);
  if (
    member.company_role === 'OWNER' &&
    company_role !== 'OWNER' &&
    (await countOwners(owner.companyId)) <= 1
  ) {
    throw httpError("L'entreprise doit garder au moins un gérant", 400);
  }
  return prisma.user.update({
    where: { id: userId },
    data: { company_role },
    select: MEMBER_SELECT,
  });
};

/**
 * Retire un membre : son compte est désactivé et détaché de l'entreprise
 * (ses mouvements restent attribués à son nom pour la traçabilité).
 */
const removeMember = async (owner, userId) => {
  if (userId === owner.id) throw httpError('Vous ne pouvez pas vous retirer vous-même', 400);
  const member = await loadMember(owner.companyId, userId);
  if (member.company_role === 'OWNER' && (await countOwners(owner.companyId)) <= 1) {
    throw httpError("L'entreprise doit garder au moins un gérant", 400);
  }
  await prisma.user.update({
    where: { id: userId },
    data: { is_active: false, companyId: null, refreshToken: null },
  });
  return { id: userId };
};

const revokeInvitation = async (owner, invitationId) => {
  const { count } = await prisma.invitation.deleteMany({
    where: { id: invitationId, companyId: owner.companyId, accepted_at: null },
  });
  if (count === 0) throw httpError('Invitation introuvable', 404);
  return { id: invitationId };
};

module.exports = {
  listTeam,
  invite,
  previewInvitation,
  acceptInvitation,
  updateMemberRole,
  removeMember,
  revokeInvitation,
  hashToken,
  ROLES,
};
