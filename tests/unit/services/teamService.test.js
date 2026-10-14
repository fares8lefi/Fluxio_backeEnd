const prisma = require('../../../config/db');
const teamService = require('../../../src/services/teamService');

jest.mock('../../../config/db', () => ({
  user: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn(), update: jest.fn() },
  invitation: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  company: { findUnique: jest.fn() },
}));
jest.mock('../../../src/repositories/userRepository', () => ({
  findOneByEmail: jest.fn(),
  create: jest.fn(),
}));
jest.mock('../../../src/services/SendEmail', () => ({
  sendInvitationEmail: jest.fn().mockResolvedValue(true),
}));
const userRepository = require('../../../src/repositories/userRepository');
const { sendInvitationEmail } = require('../../../src/services/SendEmail');

const owner = { id: 'u1', username: 'gerant', companyId: 'c1' };

describe('teamService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.company.findUnique.mockResolvedValue({ name: 'Atlas SARL' });
    prisma.invitation.create.mockImplementation(async ({ data }) => ({
      id: 'inv1',
      email: data.email,
      company_role: data.company_role,
    }));
  });

  describe('invite', () => {
    it("stocke seulement l'empreinte du jeton et renvoie le lien", async () => {
      userRepository.findOneByEmail.mockResolvedValue(null);
      const res = await teamService.invite(owner, {
        email: ' Comptable@Atlas.TN ',
        company_role: 'ACCOUNTANT',
      });

      const data = prisma.invitation.create.mock.calls[0][0].data;
      const token = res.link.split('token=')[1];
      expect(token).toMatch(/^[a-f0-9]{64}$/);
      expect(data.token_hash).toBe(teamService.hashToken(token));
      expect(data.token_hash).not.toBe(token);
      expect(data.email).toBe('comptable@atlas.tn');
      expect(res.link).toContain('#accept-invite?token=');
      expect(sendInvitationEmail).toHaveBeenCalledWith(
        'comptable@atlas.tn',
        expect.objectContaining({ companyName: 'Atlas SARL', role: 'ACCOUNTANT' })
      );
    });

    it('refuse une adresse déjà utilisée et un rôle inconnu', async () => {
      userRepository.findOneByEmail.mockResolvedValue({ id: 'x' });
      await expect(
        teamService.invite(owner, { email: 'a@b.tn', company_role: 'STOCK' })
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        teamService.invite(owner, { email: 'a@b.tn', company_role: 'BOSS' })
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('acceptInvitation', () => {
    const invitation = (extra = {}) => ({
      id: 'inv1',
      email: 'c@atlas.tn',
      company_role: 'STOCK',
      companyId: 'c1',
      expires_at: new Date(Date.now() + 3600e3),
      accepted_at: null,
      company: { name: 'Atlas SARL' },
      ...extra,
    });

    it("crée un compte actif avec le rôle invité et consomme l'invitation", async () => {
      prisma.invitation.findUnique.mockResolvedValue(invitation());
      userRepository.findOneByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue({ id: 'u9', email: 'c@atlas.tn' });

      await teamService.acceptInvitation({
        token: 'abc',
        username: 'magasin',
        password: 'Motdepasse1!',
      });

      expect(prisma.invitation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { token_hash: teamService.hashToken('abc') } })
      );
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'c@atlas.tn',
          company_role: 'STOCK',
          companyId: 'c1',
          is_active: true,
          role: 'user',
        })
      );
      expect(prisma.invitation.update).toHaveBeenCalledWith({
        where: { id: 'inv1' },
        data: { accepted_at: expect.any(Date) },
      });
    });

    it('refuse une invitation expirée ou déjà utilisée', async () => {
      prisma.invitation.findUnique.mockResolvedValueOnce(
        invitation({ expires_at: new Date(Date.now() - 1000) })
      );
      await expect(
        teamService.acceptInvitation({
          token: 'abc',
          username: 'magasin',
          password: 'Motdepasse1!',
        })
      ).rejects.toMatchObject({ statusCode: 410 });
      prisma.invitation.findUnique.mockResolvedValueOnce(invitation({ accepted_at: new Date() }));
      await expect(
        teamService.acceptInvitation({
          token: 'abc',
          username: 'magasin',
          password: 'Motdepasse1!',
        })
      ).rejects.toMatchObject({ statusCode: 410 });
      expect(userRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('gérants', () => {
    it('empêche de rétrograder le dernier gérant', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', company_role: 'OWNER' });
      prisma.user.count.mockResolvedValue(1);
      await expect(teamService.updateMemberRole(owner, 'u1', 'STOCK')).rejects.toThrow(
        /au moins un gérant/
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('empêche de se retirer soi-même', async () => {
      await expect(teamService.removeMember(owner, 'u1')).rejects.toThrow(/vous-même/);
    });

    it('retirer un membre le désactive et le détache sans supprimer son historique', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u2', company_role: 'STOCK' });
      await teamService.removeMember(owner, 'u2');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u2' },
        data: { is_active: false, companyId: null, refreshToken: null },
      });
    });
  });
});
