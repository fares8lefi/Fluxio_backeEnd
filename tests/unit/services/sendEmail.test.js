const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));
const {
  sendEmailVerificationCode,
  sendAdminVerificationCode,
  sendEmailResetCode,
  sendInvitationEmail,
} = require('../../../src/services/SendEmail');

describe('SendEmail', () => {
  beforeEach(() => {
    mockSendMail.mockReset().mockResolvedValue({});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  it.each([
    [
      'sendEmailVerificationCode',
      sendEmailVerificationCode,
      /vérification/,
      'Confirmez votre adresse email',
    ],
    [
      'sendEmailResetCode',
      sendEmailResetCode,
      /réinitialisation/,
      'Réinitialisez votre mot de passe',
    ],
  ])('%s envoie le code chiffre par chiffre', async (_name, send, subject, title) => {
    await send('demo@atlas.tn', 'Demo', 482913);
    const mail = mockSendMail.mock.calls[0][0];
    expect(mail.to).toBe('demo@atlas.tn');
    expect(mail.subject).toMatch(subject);
    expect(mail.subject).toContain('482913');
    expect(mail.text).toContain('Demo');
    expect(mail.text).toContain('482913');
    expect(mail.html).toContain(title);
    const digits = [...mail.html.matchAll(/class="fx-digit otp-digit"[^>]*>(\d)<\/div>/g)];
    expect(digits.map((m) => m[1]).join('')).toBe('482913');
  });

  it("échappe le nom d'utilisateur dans le HTML", async () => {
    await sendEmailVerificationCode('a@b.tn', '<b>Ali</b>', 1234);
    const { html } = mockSendMail.mock.calls[0][0];
    expect(html).toContain('&lt;b&gt;Ali&lt;/b&gt;');
    expect(html).not.toContain('<b>Ali</b>');
  });

  it.each([sendEmailVerificationCode, sendEmailResetCode])(
    "n'échoue pas si l'envoi échoue",
    async (send) => {
      mockSendMail.mockRejectedValue(new Error('SMTP down'));
      await expect(send('a@b.tn', 'A', 123456)).resolves.toBeUndefined();
    }
  );

  describe('sendAdminVerificationCode', () => {
    it('utilise le gabarit console : bandeau, code, périmètre et auteur échappé', async () => {
      await sendAdminVerificationCode('ops@fluxio.tn', 'Ops', 482913, 'Root <Admin>');
      const mail = mockSendMail.mock.calls[0][0];
      expect(mail.to).toBe('ops@fluxio.tn');
      expect(mail.subject).toBe('Activation de votre accès administrateur Fluxio : 482913');
      expect(mail.text).toContain('Root <Admin> vous a ouvert un accès administrateur');
      expect(mail.text).toContain('- suspendre ou réactiver entreprises et utilisateurs ;');
      expect(mail.html).toContain("Console d'administration");
      expect(mail.html).toContain('Activez votre accès administrateur');
      expect(mail.html).toContain('Root &lt;Admin&gt;');
      expect(mail.html).not.toContain('Root <Admin>');
      const digits = [...mail.html.matchAll(/class="fx-digit otp-digit"[^>]*>(\d)<\/div>/g)];
      expect(digits.map((m) => m[1]).join('')).toBe('482913');
    });

    it("reste correct sans auteur et n'échoue pas si l'envoi échoue", async () => {
      await sendAdminVerificationCode('ops@fluxio.tn', 'Ops', 123456);
      const mail = mockSendMail.mock.calls[0][0];
      expect(mail.text).toContain('Un accès administrateur à Fluxio vous a été ouvert.');
      expect(mail.html).not.toContain('undefined');

      mockSendMail.mockRejectedValue(new Error('SMTP down'));
      await expect(
        sendAdminVerificationCode('ops@fluxio.tn', 'Ops', 123456)
      ).resolves.toBeUndefined();
    });
  });

  describe('sendInvitationEmail', () => {
    it('traduit le rôle et échappe le HTML', async () => {
      const ok = await sendInvitationEmail('c@atlas.tn', {
        companyName: 'Atlas <SARL>',
        inviterName: 'Gérant "Ali"',
        role: 'ACCOUNTANT',
        link: 'https://app/#accept?token=a&b',
      });
      expect(ok).toBe(true);
      const mail = mockSendMail.mock.calls[0][0];
      expect(mail.subject).toBe('Gérant "Ali" vous invite à rejoindre Atlas <SARL> sur Fluxio');
      expect(mail.text).toContain('en tant que Comptable');
      expect(mail.html).toContain('Atlas &lt;SARL&gt;');
      expect(mail.html).toContain('Gérant &quot;Ali&quot;');
      expect(mail.html).toContain('token=a&amp;b');
      expect(mail.html).not.toContain('<SARL>');
    });

    it('garde un rôle inconnu tel quel et renvoie false en cas d’échec', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP down'));
      const ok = await sendInvitationEmail('c@atlas.tn', {
        companyName: 'Atlas',
        inviterName: 'Ali',
        role: 'AUDITOR',
        link: 'l',
      });
      expect(ok).toBe(false);
      expect(mockSendMail.mock.calls[0][0].text).toContain('en tant que AUDITOR');
    });
  });
});
