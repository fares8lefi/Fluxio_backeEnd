const prisma = require('../../config/db');
const bcrypt = require('bcrypt');

// Crée un utilisateur (hash le mot de passe avant insertion)
const create = async (data) => {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);
    return  prisma.user.create({
        data: { ...data, password: hashedPassword },
    });
};

// Recherche par email (sans le mot de passe)
const findOneByEmail = async (email) => {
    return  prisma.user.findUnique({
        where: { email },
        select: {
            id: true, username: true, email: true,
            role: true, is_active: true, phone: true,
            created_at: true, last_login: true, companyId: true,
        },
    });
};

// Recherche par email AVEC mot de passe (pour la connexion)
const findOneByEmailWithPassword = async (email) => {
    return  prisma.user.findUnique({ where: { email } });
};

// Recherche par ID (sans le mot de passe)
const findById = async (id) => {
    return  prisma.user.findUnique({
        where: { id: id },
        select: {
            id: true, username: true, email: true,
            role: true, is_active: true, phone: true,
            created_at: true, last_login: true, companyId: true,
        },
    });
};

// Recherche par ID AVEC mot de passe (pour vérification)
const findByIdWithPassword = async (id) => {
    return  prisma.user.findUnique({ where: { id: id } });
};

// Met à jour un utilisateur
const update = async (id, updates) => {
    return  prisma.user.update({
        where: { id: id },
        data: updates,
        select: {
            id: true, username: true, email: true,
            role: true, is_active: true, phone: true,
            created_at: true, last_login: true, companyId: true,
        },
    });
};

// Récupère tous les utilisateurs (sans mot de passe ni code)
const findAll = async () => {
    return  prisma.user.findMany({
        select: {
            id: true, username: true, email: true,
            role: true, is_active: true, phone: true,
            created_at: true, last_login: true, companyId: true,
        },
    });
};

// Vérifie le mot de passe actuel d'un utilisateur
const verifPasswordUser = async (id, currentPassword) => {
    const user = await findByIdWithPassword(id);
    if (!user) return false;
    return  bcrypt.compare(currentPassword, user.password);
};

// Supprime définitivement un utilisateur (admin only)
const deleteById = async (id) => {
    return prisma.user.delete({ where: { id } });
};

module.exports = {
    create,
    findOneByEmail,
    findOneByEmailWithPassword,
    findById,
    findByIdWithPassword,
    update,
    findAll,
    verifPasswordUser,
    deleteById,
};
