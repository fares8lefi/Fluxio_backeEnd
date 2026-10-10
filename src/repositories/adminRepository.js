const prisma = require('../../config/db');

/**
 * Stats globales de la plateforme
 */
const getPlatformStats = async () => {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [
    totalCompanies,
    activeCompanies,
    totalUsers,
    activeUsers,
    newCompaniesThisMonth,
    newUsersThisMonth,
  ] = await prisma.$transaction([
    prisma.company.count(),
    prisma.company.count({ where: { is_active: true } }),
    prisma.user.count(),
    prisma.user.count({ where: { is_active: true } }),
    prisma.company.count({ where: { created_at: { gte: startOfMonth } } }),
    prisma.user.count({ where: { created_at: { gte: startOfMonth } } }),
  ]);

  return {
    totalCompanies,
    activeCompanies,
    suspendedCompanies: totalCompanies - activeCompanies,
    totalUsers,
    activeUsers,
    suspendedUsers: totalUsers - activeUsers,
    newCompaniesThisMonth,
    newUsersThisMonth,
  };
};

/**
 * Liste toutes les entreprises avec pagination et recherche
 */
const findAllCompanies = async ({ page = 1, limit = 20, search = '' }) => {
  const skip = (page - 1) * limit;
  const where = search ? { name: { contains: search } } : {};

  const [companies, total] = await prisma.$transaction([
    prisma.company.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        _count: {
          select: { users: true, products: true, movements: true, invoices: true },
        },
      },
    }),
    prisma.company.count({ where }),
  ]);

  return { companies, total, page, limit, totalPages: Math.ceil(total / limit) };
};

/**
 * Détail d'une entreprise (utilisateurs + compteurs)
 */
const findCompanyById = async (id) => {
  return prisma.company.findUnique({
    where: { id },
    include: {
      users: {
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          is_active: true,
          created_at: true,
          last_login: true,
        },
        orderBy: { created_at: 'desc' },
      },
      _count: {
        select: { products: true, movements: true, invoices: true, clients: true, suppliers: true },
      },
    },
  });
};

/**
 * Modifier uniquement les données générales d'une entreprise (pas les données de stock)
 */
const updateCompanyGeneralInfo = async (id, data) => {
  return prisma.company.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      matriculeFiscale: true,
      address: true,
      phone: true,
      is_active: true,
      created_at: true,
    },
  });
};

/**
 * Activer ou suspendre une entreprise
 */
const updateCompanyStatus = async (id, is_active) => {
  return prisma.company.update({
    where: { id },
    data: { is_active },
    select: { id: true, name: true, is_active: true },
  });
};

/**
 * Activer ou suspendre un utilisateur
 */
const updateUserActiveStatus = async (id, is_active) => {
  return prisma.user.update({
    where: { id },
    data: { is_active },
    select: { id: true, username: true, email: true, is_active: true, role: true },
  });
};

module.exports = {
  getPlatformStats,
  findAllCompanies,
  findCompanyById,
  updateCompanyGeneralInfo,
  updateCompanyStatus,
  updateUserActiveStatus,
};
