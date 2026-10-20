const prisma = require('../../../config/db');
const teamService = require('../../../src/services/teamService');

jest.mock('../../../config/db', () => ({
  user: { findMany: jest.fn() },
  invitation: { findMany: jest.fn(), findUnique: jest.fn(), deleteMany: jest.fn() },
}));
jest.mock('../../../src/repositories/userRepository', () => ({}));
jest.mock('../../../src/services/SendEmail', () => ({ sendInvitationEmail: jest.fn() }));

describe('teamService — équipe et invitations', () => {
  beforeEach(() => jest.clearAllMocks());

  it('listTeam renvoie les membres et les invitations encore valides', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    prisma.invitation.findMany.mockResolvedValue([{ id: 'inv1' }]);

    await expect(teamService.listTeam('c1')).resolves.toEqual({
      members: [{ id: 'u1' }],
      invitations: [{ id: 'inv1' }],
    });
    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ companyId: 'c1' });
    const where = prisma.invitation.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ companyId: 'c1', accepted_at: null });
    expect(where.expires_at.gt).toBeInstanceOf(Date);
  });

  describe('previewInvitation', () => {
    it('affiche le rôle et la société sans exposer le jeton', async () => {
      prisma.invitation.findUnique.mockResolvedValue({
        email: 'c@atlas.tn',
        company_role: 'STOCK',
        token_hash: 'secret',
        accepted_at: null,
        expires_at: new Date(Date.now() + 3600e3),
        company: { name: 'Atlas SARL' },
      });
      await expect(teamService.previewInvitation('tok')).resolves.toEqual({
        email: 'c@atlas.tn',
        company_role: 'STOCK',
        company_name: 'Atlas SARL',
      });
      expect(prisma.invitation.findUnique.mock.calls[0][0].where).toEqual({
        token_hash: teamService.hashToken('tok'),
      });
    });

    it.each([
      ['un jeton manquant', undefined, null, 400],
      ['un jeton inconnu', 'tok', null, 404],
      ['une invitation utilisée', 'tok', { accepted_at: new Date(), expires_at: new Date() }, 410],
      ['une invitation expirée', 'tok', { accepted_at: null, expires_at: new Date(0) }, 410],
    ])('refuse %s', async (_label, token, invitation, statusCode) => {
      prisma.invitation.findUnique.mockResolvedValue(invitation);
      await expect(teamService.previewInvitation(token)).rejects.toMatchObject({ statusCode });
    });
  });

  describe('revokeInvitation', () => {
    it("supprime une invitation en attente de l'entreprise", async () => {
      prisma.invitation.deleteMany.mockResolvedValue({ count: 1 });
      await expect(teamService.revokeInvitation({ companyId: 'c1' }, 'inv1')).resolves.toEqual({
        id: 'inv1',
      });
      expect(prisma.invitation.deleteMany).toHaveBeenCalledWith({
        where: { id: 'inv1', companyId: 'c1', accepted_at: null },
      });
    });

    it('renvoie 404 si rien ne correspond', async () => {
      prisma.invitation.deleteMany.mockResolvedValue({ count: 0 });
      await expect(teamService.revokeInvitation({ companyId: 'c1' }, 'inv1')).rejects.toMatchObject(
        { statusCode: 404 }
      );
    });
  });
});
