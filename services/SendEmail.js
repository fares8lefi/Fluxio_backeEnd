const nodemailer = require("nodemailer");


const transporter =nodemailer.createTransport({
    service:"gmail",
    auth:{
        user:process.env.EmailUser,
        password:process.env.password
    }
})
 
const htmlTemplate = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Vérification de compte — Fluxio</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background-color: #060B18;
    font-family: Arial, sans-serif;
    color: #F1F5F9;
    padding: 40px 16px;
  }
  .email-wrapper { max-width: 560px; margin: 0 auto; }
 
  /* Header */
  .email-header { text-align: center; padding-bottom: 32px; }
  .logo-container { display: inline-flex; align-items: center; gap: 12px; }
  .logo-icon {
    width: 44px; height: 44px; border-radius: 12px;
    background: linear-gradient(135deg, #1D4ED8 0%, #0E7490 100%);
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 22px; font-weight: 900; color: white; font-family: Georgia, serif;
  }
  .logo-text { font-size: 28px; font-weight: 800; letter-spacing: -1px; line-height: 1; }
  .logo-text .flux { color: #06B6D4; }
  .logo-text .io   { color: #93C5FD; font-weight: 300; }
 
  /* Card */
  .email-card {
    background: #111827;
    border: 1px solid #1F2D45;
    border-radius: 24px;
    overflow: hidden;
  }
  .card-bar {
    height: 4px;
    background: linear-gradient(90deg, #1D4ED8 0%, #06B6D4 50%, #0D9488 100%);
  }
  .card-body { padding: 44px 48px 40px; }
 
  /* Icon */
  .verify-icon {
    width: 72px; height: 72px; margin: 0 auto 28px;
    background: linear-gradient(135deg, rgba(37,99,235,0.2), rgba(6,182,212,0.2));
    border: 1px solid rgba(6,182,212,0.3);
    border-radius: 20px;
    display: flex; align-items: center; justify-content: center;
    font-size: 32px;
  }
 
  /* Title */
  .card-title {
    font-size: 26px; font-weight: 800; letter-spacing: -0.8px;
    text-align: center; margin-bottom: 10px; color: #F1F5F9;
  }
  .card-subtitle {
    font-size: 15px; color: #94A3B8;
    text-align: center; line-height: 1.6; margin-bottom: 36px;
  }
  .card-subtitle strong { color: #CBD5E1; font-weight: 600; }
 
  /* Divider */
  .divider { border: none; border-top: 1px solid #1F2D45; margin: 32px 0; }
 
  /* OTP */
  .otp-label {
    font-size: 11px; font-weight: 700; letter-spacing: 0.2em;
    text-transform: uppercase; color: #475569;
    text-align: center; margin-bottom: 16px;
  }
  .otp-container {
    display: flex; justify-content: center; gap: 10px; margin-bottom: 16px;
  }
  .otp-digit {
    width: 58px; height: 68px;
    background: #1A2236;
    border: 1.5px solid #2A3A55;
    border-radius: 14px;
    display: inline-flex; align-items: center; justify-content: center;
    font-family: 'Courier New', monospace;
    font-size: 28px; font-weight: 700; color: #F1F5F9;
  }
  .otp-digit.accent {
    border-color: rgba(6,182,212,0.5);
    background: linear-gradient(180deg, rgba(6,182,212,0.08) 0%, #1A2236 100%);
    color: #22D3EE;
  }
  .otp-timer {
    display: flex; align-items: center; justify-content: center;
    gap: 6px; font-size: 13px; color: #475569; font-weight: 500;
  }
  .timer-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #F59E0B; display: inline-block;
  }
  .timer-time { color: #F59E0B; font-weight: 700; font-family: 'Courier New', monospace; }
 
  /* Boxes */
  .warning-box {
    background: rgba(245,158,11,0.08);
    border: 1px solid rgba(245,158,11,0.2);
    border-radius: 12px; padding: 14px 18px;
    display: flex; gap: 12px; align-items: flex-start; margin: 32px 0;
  }
  .warning-text { font-size: 13px; color: #CBD5E1; line-height: 1.6; }
  .warning-text strong { color: #FCD34D; font-weight: 600; }
  .info-box {
    background: rgba(37,99,235,0.08);
    border: 1px solid rgba(37,99,235,0.2);
    border-radius: 12px; padding: 14px 18px;
    display: flex; gap: 12px; align-items: flex-start;
  }
  .info-text { font-size: 13px; color: #94A3B8; line-height: 1.6; }
  .info-text a { color: #60A5FA; text-decoration: none; font-weight: 600; }
 
  /* Footer */
  .email-footer { padding: 32px 48px 32px; text-align: center; }
  .footer-links { display: flex; justify-content: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
  .footer-links a { font-size: 12px; color: #475569; text-decoration: none; font-weight: 500; }
  .footer-separator { color: #2A3A55; font-size: 12px; }
  .footer-copy { font-size: 12px; color: #334155; line-height: 1.7; }
  .footer-brand { font-weight: 700; color: #475569; }
  .footer-brand .f { color: #06B6D4; }
</style>
</head>
<body>
<div class="email-wrapper">
 
  <!-- Logo -->
  <div class="email-header">
    <div class="logo-container">
      <div class="logo-icon">F</div>
      <div class="logo-text">
        <span class="flux">Flux</span><span class="io">io</span>
      </div>
    </div>
  </div>
 
  <!-- Card -->
  <div class="email-card">
    <div class="card-bar"></div>
    <div class="card-body">
 
      <div class="verify-icon">🔐</div>
 
      <h1 class="card-title">Vérifiez votre compte</h1>
      <p class="card-subtitle">
        Bonjour <strong>${username}</strong> 👋<br>
        Entrez le code ci-dessous pour confirmer votre adresse email et activer votre compte Fluxio.
      </p>
 
      <hr class="divider">
 
      <div class="otp-label">Votre code de vérification</div>
      <div class="otp-container">
        ${otpDigits}
      </div>
      <div class="otp-timer">
        <span class="timer-dot"></span>
        Ce code expire dans&nbsp;<span class="timer-time">10:00</span>
      </div>
 
      <hr class="divider">
 
      <div class="warning-box">
        <span style="font-size:16px;flex-shrink:0">⚠️</span>
        <p class="warning-text">
          <strong>Ne partagez jamais ce code.</strong> L'équipe Fluxio ne vous demandera jamais votre code de vérification par email, téléphone ou messagerie.
        </p>
      </div>
 
      <div class="info-box">
        <span style="font-size:16px;flex-shrink:0">ℹ️</span>
        <p class="info-text">
          Vous n'avez pas créé de compte sur Fluxio ? Ignorez simplement cet email, aucune action n'est requise.
          Pour toute question : <a href="mailto:support@fluxio.io">support@fluxio.io</a>
        </p>
      </div>
 
    </div>
 
    <div class="email-footer">
      <div class="footer-links">
        <a href="#">Aide</a>
        <span class="footer-separator">·</span>
        <a href="#">Confidentialité</a>
        <span class="footer-separator">·</span>
        <a href="#">Conditions d'utilisation</a>
        <span class="footer-separator">·</span>
        <a href="#">Se désabonner</a>
      </div>
      <p class="footer-copy">
        <span class="footer-brand"><span class="f">Flux</span>io</span> — Stock Management<br>
        © 2026 Fluxio. Tous droits réservés.<br>
        Alger, Algérie · <a href="https://fluxio.io" style="color:#334155;text-decoration:none;">fluxio.io</a>
      </p>
    </div>
  </div>
 
</div>
</body>
</html>`;
const sendEmailVerificationCode=async(email, username, code)=>{
    try{
        const mailOptions={
            from:process.env.EmailUser,
            to:email,
            subject:`Votre code de vérification Fluxio : ${code}`,
            text:`Hello ${username}, 
                    Pour activer votre compte, utilisez le code de vérification ci-dessous :
                    ${code}
                    Si vous n'avez pas initié cette demande, veuillez ignorer cet e-mail.
                    Cordialement,
                    L'équipe Fluxio
                    © 2026 Fluxio. Tous droits réservés.`,
                    html:htmlTemplate    
        }
        await transporter.sendMail(mailOptions);
        console.log("Email sent successfully");
    }catch(error){
        console.log(error);
    }
}

const sendEmailResetCode=async(email, username, code)=>{
    try{
        
        const mailOptions={
            from:process.env.EmailUser,
            to:email,
            subject:`Votre code de réinitialisation de mot de passe Fluxio : ${code}`,
            text:`Hello ${username}, 
                    Pour réinitialiser votre mot de passe, utilisez le code de réinitialisation ci-dessous :
                    ${code}
                    Si vous n'avez pas initié cette demande, veuillez ignorer cet e-mail.
                    Cordialement,
                    L'équipe Fluxio
                    © 2026 Fluxio. Tous droits réservés.`,    
                    html:htmlTemplate    
        }
        await transporter.sendMail(mailOptions);
        console.log("Email sent successfully");
    }catch(error){
        console.log(error);
    }
}

module.exports={sendEmailVerificationCode,sendEmailResetCode}