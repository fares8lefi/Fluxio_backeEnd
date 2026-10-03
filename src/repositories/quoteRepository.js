const prisma = require('../../config/db');

const createQuote = async (data) => {
  return prisma.quote.create({
    data,
    include: { client: true, company: true },
  });
};

const findAll = async (companyId, filters = {}) => {
  const where = { companyId };
  if (filters.status) where.status = filters.status;
  if (filters.clientId) where.clientId = filters.clientId;

  return prisma.quote.findMany({
    where,
    orderBy: { date: 'desc' },
    include: { client: true, company: true },
  });
};

const getById = async (id, companyId) => {
  return prisma.quote.findFirst({
    where: { id, companyId },
    include: { client: true, company: true },
  });
};

const updateStatus = async (id, status, companyId, extra = {}) => {
  return prisma.quote.update({
    where: { id, companyId },
    data: { status, ...extra },
  });
};

const getLastReferenceNumber = async (companyId, year) => {
  const pattern = `DEV-${year}-`;
  const last = await prisma.quote.findFirst({
    where: { companyId, reference: { startsWith: pattern } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  if (!last || !last.reference) return 0;
  const parts = last.reference.split('-');
  const num = parseInt(parts[parts.length - 1], 10);
  return isNaN(num) ? 0 : num;
};

module.exports = {
  createQuote,
  findAll,
  getById,
  updateStatus,
  getLastReferenceNumber,
};
