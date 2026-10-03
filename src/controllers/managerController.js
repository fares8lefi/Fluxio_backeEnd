const managerService = require('../services/managerService');

/**
 * Résout l'entreprise courante depuis la session.
 * Le `companyId` n'est JAMAIS lu dans la requête : il vient du JWT décodé
 * par `requireAuthUser` → chaque réponse est strictement scopée à l'entreprise
 * de l'utilisateur (protection IDOR).
 */
const getCompanyId = (req) => {
  const user = req.session?.user || req.user;
  return user?.companyId || null;
};

/** Enveloppe commune : mêmes codes HTTP que le reste du projet */
const handle = (block) => async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) {
      return res.status(403).json({ success: false, message: 'Aucune entreprise associée' });
    }

    const data = await managerService[block](companyId, req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode === 500) {
      // On ne remonte jamais le détail technique au client
      console.error(`[manager:${block}]`, error);
      return res
        .status(500)
        .json({ success: false, message: 'Impossible de calculer les indicateurs' });
    }
    return res.status(statusCode).json({ success: false, message: error.message });
  }
};

module.exports = {
  getKpis: handle('getManagerKpis'),
  getSales: handle('getManagerSales'),
  getClients: handle('getManagerClients'),
  getStock: handle('getManagerStock'),
  getActivity: handle('getManagerActivity'),
};