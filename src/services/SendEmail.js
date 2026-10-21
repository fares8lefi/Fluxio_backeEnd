const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EmailUser,
    pass: process.env.EmailPassword,
  },
});

const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

const frontendUrl = () =>
  (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].replace(/\/$/, '');

// ─── Identité visuelle (reprise de Fluxio/src/index.css) ────────────────────
// Papier + encre pétrole, une seule famille (Archivo) dont la largeur étendue
// porte les titres et les chiffres. Styles inline : Gmail/Outlook ignorent
// une bonne partie des <style>, qui ne servent ici qu'au mobile et au mode sombre.
const C = {
  paper: '#f4f6f6',
  sheet: '#ffffff',
  ink: '#15252a',
  inkDeep: '#0b1a1e',
  muted: '#637477',
  border: '#dde3e4',
  control: '#bcc7c9',
  petrol: '#0f5a63',
  petrolSoft: '#eef8f8',
  amber: '#e8a33d',
};
const FONT = "'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const EXPANDED = 'font-stretch:125%;';

// Logo en cellules de tableau (le SVG est bloqué par Gmail) : trois niveaux de
// stock qui baissent, le dernier sous son seuil d'alerte, en ambre.
const logo = () => {
  const bar = (height, color) =>
    `<td valign="bottom" style="padding:0 3px 0 0;"><div class="${color === C.amber ? '' : 'fx-bar'}" style="width:5px;height:${height}px;background:${color};border-radius:1px;font-size:0;line-height:0;">&nbsp;</div></td>`;
  return `<a href="${escapeHtml(frontendUrl())}" style="text-decoration:none;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td valign="bottom" style="padding:0 8px 0 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" height="18"><tr>
        ${bar(18, C.petrol)}${bar(13, C.petrol)}${bar(6, C.amber)}
      </tr></table>
    </td>
    <td valign="bottom" class="fx-logo" style="font-family:${FONT};${EXPANDED}font-size:19px;line-height:18px;font-weight:600;letter-spacing:-0.02em;color:#072429;">Fluxio</td>
  </tr></table>
</a>`;
};

/** Gabarit commun : fond papier, logo, feuille blanche, pied de page. */
const layout = ({ title, preheader, body, reason }) => `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,400..700&display=swap" rel="stylesheet">
<style>
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
  @media (max-width: 600px) {
    .fx-outer { padding: 24px 12px !important; }
    .fx-sheet-pad { padding: 28px 22px !important; }
    .fx-title { font-size: 23px !important; }
    .fx-digit { width: 40px !important; height: 52px !important; font-size: 26px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .fx-bg { background: #0b1a1e !important; }
    .fx-sheet { background: #15252a !important; border-color: #36464a !important; }
    .fx-ink, .fx-title, .fx-logo { color: #f4f6f6 !important; }
    .fx-muted { color: #8d9c9f !important; }
    .fx-band { background: #0e3b43 !important; }
    .fx-digit { background: #0b1a1e !important; border-color: #36464a !important; color: #f4f6f6 !important; }
    .fx-rule { border-color: #36464a !important; }
    .fx-link { color: #72c2c8 !important; }
    .fx-bar { background: #72c2c8 !important; }
  }
</style>
</head>
<body class="fx-bg" style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="fx-bg" style="background:${C.paper};">
  <tr><td align="center" class="fx-outer" style="padding:40px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
      <tr><td style="padding:0 4px 20px;">${logo()}</td></tr>
      <tr><td class="fx-sheet" style="background:${C.sheet};border:1px solid ${C.border};border-radius:14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td class="fx-sheet-pad" style="padding:40px 44px;font-family:${FONT};">
            ${body}
          </td></tr>
        </table>
      </td></tr>
      <tr><td class="fx-muted" style="padding:20px 4px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};">
        ${reason}<br>
        Fluxio, gestion de stock et facturation. © ${new Date().getFullYear()} Fluxio.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

const heading = (text) =>
  `<h1 class="fx-title" style="margin:0 0 12px;font-family:${FONT};${EXPANDED}font-size:26px;line-height:1.2;font-weight:600;letter-spacing:-0.015em;color:${C.ink};">${text}</h1>`;

const paragraph = (html, { muted = false, size = 15, spacing = 0 } = {}) =>
  `<p class="${muted ? 'fx-muted' : 'fx-ink'}" style="margin:0 0 ${spacing}px;font-family:${FONT};font-size:${size}px;line-height:1.6;color:${muted ? C.muted : C.ink};">${html}</p>`;

const rule = () =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="fx-rule" style="border-top:1px solid ${C.border};font-size:0;line-height:0;height:24px;">&nbsp;</td></tr></table>`;

/** Le code, chiffre par chiffre, sur une bande pétrole claire. */
const codeBlock = (code) => {
  const digits = String(code)
    .split('')
    .map(
      (digit) =>
        `<td style="padding:0 8px 0 0;"><div class="fx-digit otp-digit" style="width:48px;height:60px;line-height:60px;text-align:center;background:${C.sheet};border:1px solid ${C.control};border-radius:8px;font-family:${FONT};${EXPANDED}font-size:30px;font-weight:600;font-variant-numeric:tabular-nums;color:${C.inkDeep};">${escapeHtml(digit)}</div></td>`
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
  <tr><td class="fx-band" style="background:${C.petrolSoft};border-radius:10px;padding:20px 20px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${digits}</tr></table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;"><tr>
      <td valign="middle" style="padding:0 8px 0 0;"><div style="width:4px;height:12px;background:${C.amber};border-radius:1px;font-size:0;line-height:0;">&nbsp;</div></td>
      <td valign="middle" class="fx-muted" style="font-family:${FONT};font-size:13px;line-height:1;color:${C.muted};">Valable 10 minutes</td>
    </tr></table>
  </td></tr>
</table>`;
};

/** Bouton « bulletproof » : un lien dans une cellule, rendu partout, Outlook compris. */
const button = (href, label) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;"><tr>
  <td style="background:${C.petrol};border-radius:8px;">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 22px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
  </td>
</tr></table>`;

const SECURITY_NOTE =
  'Fluxio ne vous demandera jamais ce code par téléphone ou par message. Ne le transmettez à personne.';

const codeEmail = ({ title, intro, code, ignoreNote, reason }) =>
  layout({
    title: `${title} | Fluxio`,
    preheader: `Votre code Fluxio : ${code}. Valable 10 minutes.`,
    reason,
    body: [
      heading(title),
      paragraph(intro),
      codeBlock(code),
      rule(),
      paragraph(SECURITY_NOTE, { muted: true, size: 13, spacing: 10 }),
      paragraph(ignoreNote, { muted: true, size: 13 }),
    ].join('\n'),
  });

const verificationHtml = (username, code) =>
  codeEmail({
    title: 'Confirmez votre adresse email',
    intro: `Bonjour ${escapeHtml(username)}, saisissez ce code dans Fluxio pour activer votre compte.`,
    code,
    ignoreNote:
      "Vous n'avez pas créé de compte ? Ignorez cet email : sans ce code, le compte reste inactif.",
    reason: 'Vous recevez cet email car cette adresse a servi à créer un compte Fluxio.',
  });

const resetHtml = (username, code) =>
  codeEmail({
    title: 'Réinitialisez votre mot de passe',
    intro: `Bonjour ${escapeHtml(username)}, saisissez ce code dans Fluxio pour choisir un nouveau mot de passe.`,
    code,
    ignoreNote:
      "Vous n'avez rien demandé ? Ignorez cet email : votre mot de passe actuel reste valable.",
    reason:
      'Vous recevez cet email car une réinitialisation de mot de passe a été demandée pour ce compte Fluxio.',
  });

const invitationHtml = ({ companyName, inviterName, roleLabel, link }) =>
  layout({
    title: `Invitation à rejoindre ${companyName} | Fluxio`,
    preheader: `${inviterName} vous invite à rejoindre ${companyName} en tant que ${roleLabel}.`,
    reason: `Vous recevez cet email car ${escapeHtml(inviterName)} a saisi cette adresse pour vous inviter.`,
    body: [
      heading(`Rejoignez ${escapeHtml(companyName)} sur Fluxio`),
      paragraph(
        `<strong>${escapeHtml(inviterName)}</strong> vous invite à rejoindre l'équipe de <strong>${escapeHtml(companyName)}</strong> en tant que <strong>${escapeHtml(roleLabel)}</strong>.`
      ),
      button(link, 'Créer mon accès'),
      rule(),
      paragraph("Ce lien est valable 7 jours et ne fonctionne qu'une fois.", {
        muted: true,
        size: 13,
        spacing: 10,
      }),
      paragraph(
        `Le bouton ne s'ouvre pas ? Copiez ce lien dans votre navigateur :<br><a class="fx-link" href="${escapeHtml(link)}" style="color:${C.petrol};word-break:break-all;">${escapeHtml(link)}</a>`,
        { muted: true, size: 13, spacing: 10 }
      ),
      paragraph("Vous n'attendiez pas cette invitation ? Ignorez cet email.", {
        muted: true,
        size: 13,
      }),
    ].join('\n'),
  });

const sendEmailVerificationCode = async (email, username, code) => {
  try {
    const mailOptions = {
      from: process.env.EmailUser,
      to: email,
      subject: `Votre code de vérification Fluxio : ${code}`,
      text: `Bonjour ${username},

Saisissez ce code dans Fluxio pour activer votre compte : ${code}
Il est valable 10 minutes.

${SECURITY_NOTE}
Vous n'avez pas créé de compte ? Ignorez cet email.

L'équipe Fluxio`,
      html: verificationHtml(username, code),
    };
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
  } catch (error) {
    console.log(error);
  }
};

const sendEmailResetCode = async (email, username, code) => {
  try {
    const mailOptions = {
      from: process.env.EmailUser,
      to: email,
      subject: `Votre code de réinitialisation de mot de passe Fluxio : ${code}`,
      text: `Bonjour ${username},

Saisissez ce code dans Fluxio pour choisir un nouveau mot de passe : ${code}
Il est valable 10 minutes.

${SECURITY_NOTE}
Vous n'avez rien demandé ? Ignorez cet email : votre mot de passe actuel reste valable.

L'équipe Fluxio`,
      html: resetHtml(username, code),
    };
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
  } catch (error) {
    console.log(error);
  }
};

const ROLE_LABELS = { OWNER: 'Gérant', STOCK: 'Magasinier', ACCOUNTANT: 'Comptable' };

/** Invitation à rejoindre une entreprise sur Fluxio */
const sendInvitationEmail = async (email, { companyName, inviterName, role, link }) => {
  try {
    const roleLabel = ROLE_LABELS[role] ?? role;
    await transporter.sendMail({
      from: process.env.EmailUser,
      to: email,
      subject: `${inviterName} vous invite à rejoindre ${companyName} sur Fluxio`,
      text: `Bonjour,

${inviterName} vous invite à rejoindre ${companyName} sur Fluxio en tant que ${roleLabel}.

Créez votre accès avec ce lien (valable 7 jours) :
${link}

Si vous n'attendiez pas cette invitation, ignorez cet e-mail.

L'équipe Fluxio`,
      html: invitationHtml({ companyName, inviterName, roleLabel, link }),
    });
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
};

module.exports = { sendEmailVerificationCode, sendEmailResetCode, sendInvitationEmail };
