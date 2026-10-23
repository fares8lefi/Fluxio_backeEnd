/**
 * Crée le compte administrateur de la plateforme directement en base.
 *
 * Le compte est créé actif et vérifié : connexion immédiate, sans code OTP.
 * Si l'email existe déjà, l'utilisateur passe admin et son mot de passe est remplacé.
 * Le mot de passe n'est jamais écrit dans le code : il vient de ADMIN_PASSWORD.
 *
 * Usage (dans le conteneur) :
 *   docker compose exec -e ADMIN_PASSWORD='MotDePasse!' backend npm run seed
 *   Optionnel : ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PHONE
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const prisma = require('../config/db');
const { validateAdminCreation } = require('../src/validations/UserValidations');

const DEFAULT_EMAIL = 'fereslefi2001@gmail.com';

const run = async () => {
  const email = (process.env.ADMIN_EMAIL || DEFAULT_EMAIL).trim().toLowerCase();
  const data = {
    email,
    username: process.env.ADMIN_USERNAME || email.split('@')[0],
    password: process.env.ADMIN_PASSWORD,
    ...(process.env.ADMIN_PHONE && { phone: process.env.ADMIN_PHONE }),
  };

  if (!data.password) throw new Error('ADMIN_PASSWORD manquant');
  const { errors, isValid } = validateAdminCreation(data);
  if (!isValid) throw new Error(`Validation échouée : ${JSON.stringify(errors)}`);

  const fields = {
    password: await bcrypt.hash(data.password, await bcrypt.genSalt(10)),
    role: 'admin',
    is_active: true,
    email_verified: true,
    code: null,
    code_expires_at: null,
    code_attempts: 0,
  };

  const existing = await prisma.user.findUnique({ where: { email } });
  const admin = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: fields })
    : await prisma.user.create({
        data: {
          ...fields,
          email,
          username: data.username.trim(),
          phone: data.phone ? data.phone.trim() : null,
        },
      });

  console.log(`Admin ${existing ? 'mis à jour' : 'créé'} : ${admin.email} (${admin.username})`);
};

if (require.main === module) {
  run()
    .catch((error) => {
      console.error(error.message || error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { run };
