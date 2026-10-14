const express = require('express');
const router = express.Router();
const teamService = require('../services/teamService');
const { requireAuthUser } = require('../middlewares/authMiddelwares');
const { ownerOnly } = require('../middlewares/companyRole');
const { otpLimiter } = require('../middlewares/rateLimiters');

const currentUser = (req) => req.user || (req.session && req.session.user);

/** Exécute une action du service et renvoie le JSON standard */
const handle =
  (action, status = 200) =>
  async (req, res) => {
    try {
      const result = await action(req);
      return res.status(status).json({ success: true, ...result });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message,
        ...(error.details && { errors: error.details }),
      });
    }
  };

// ── Public : la personne invitée n'a pas encore de compte ─────────────────
router.get(
  '/invitations/preview',
  otpLimiter,
  handle((req) => teamService.previewInvitation(req.query.token))
);
router.post(
  '/invitations/accept',
  otpLimiter,
  handle((req) => teamService.acceptInvitation(req.body).then((user) => ({ user })), 201)
);

// ── Gestion de l'équipe : réservée aux gérants ────────────────────────────
router.get(
  '/',
  requireAuthUser,
  ownerOnly,
  handle((req) => teamService.listTeam(currentUser(req).companyId))
);
router.post(
  '/invitations',
  requireAuthUser,
  ownerOnly,
  handle((req) => teamService.invite(currentUser(req), req.body), 201)
);
router.delete(
  '/invitations/:id',
  requireAuthUser,
  ownerOnly,
  handle((req) => teamService.revokeInvitation(currentUser(req), req.params.id))
);
router.patch(
  '/members/:id',
  requireAuthUser,
  ownerOnly,
  handle((req) =>
    teamService
      .updateMemberRole(currentUser(req), req.params.id, req.body.company_role)
      .then((member) => ({ member }))
  )
);
router.delete(
  '/members/:id',
  requireAuthUser,
  ownerOnly,
  handle((req) => teamService.removeMember(currentUser(req), req.params.id))
);

module.exports = router;
