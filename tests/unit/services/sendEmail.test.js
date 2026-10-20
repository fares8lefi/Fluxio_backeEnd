const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));
const {
  sendEmailVerificationCode,
  sendEmailResetCode,
  sendInvitationEmail,
} = require('../../../src/services/SendEmail');

describe('SendEmail', () => {
  beforeEach(() => {
    mockSendMail.mockReset().mockResolvedValue({});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  it.each([
    ['sendEmailVerificationCode', sendEmailVerificationCode, /vérification/],
    ['sendEmailResetCode', sendEmailResetCode, /réinitialisation/],
  ])('%s envoie le code chiffre par chiffre', async (_name, send, subject) => {
    await send('demo@atlas.tn', 'Demo', 482913);
    const mail = mockSendMail.mock.calls[0][0];
    expect(mail.to).toBe('demo@atlas.tn');
    expect(mail.subject).toMatch(subject);
    expect(mail.subject).toContain('482913');
    expect(mail.text).toContain('Demo');
    expect(mail.html).toContain('<div class="otp-digit accent">4</div>');
    expect(mail.html.match(/class="otp-digit/g)).toHaveLength(6);
  });

  it.each([sendEmailVerificationCode, sendEmailResetCode])(
    "n'échoue pas si l'envoi échoue",
    async (send) => {
      mockSendMail.mockRejectedValue(new Error('SMTP down'));
      await expect(send('a@b.tn', 'A', 123456)).resolves.toBeUndefined();
    }
  );

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
