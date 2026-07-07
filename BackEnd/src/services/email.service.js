import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const { GMAIL_USER, GMAIL_PASS, FRONTEND_URL = "http://localhost:5173" } = process.env;

const normalizeBaseUrl = (url = FRONTEND_URL) => url.replace(/\/+$/, "");

// Create SMTP transporter if credentials exist
const getTransporter = () => {
  if (!GMAIL_USER || !GMAIL_PASS) return null;

  const emailLower = GMAIL_USER.toLowerCase();
  
  // Default to Outlook/Office 365 for any non-Gmail accounts (covering Hotmail, Outlook, .edu.mx, and tecnm.mx domains)
  const isOutlook = !emailLower.endsWith("@gmail.com") ||
                    process.env.MAIL_SERVICE === "outlook" ||
                    process.env.MAIL_SERVICE === "office365";

  if (isOutlook) {
    console.log("[email.service] Configuring transporter for Outlook/Office365/Exchange...");
    return nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false, // true for port 465, false for other ports (uses STARTTLS)
      requireTLS: true,
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_PASS, // Outlook account password or App Password
      },
      tls: {
        ciphers: "SSLv3",
        rejectUnauthorized: false
      }
    });
  } else {
    console.log("[email.service] Configuring transporter for Gmail...");
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_PASS, // Gmail App Password
      },
    });
  }
};

const transporter = getTransporter();

/**
 * Sends a password recovery email to a user.
 * @param {string} toEmail - Recipient email
 * @param {string} userName - Name of the user
 * @param {string} token - Password reset token
 */
export const sendRecoveryEmail = async (toEmail, userName, token, frontendUrl = FRONTEND_URL) => {
  const resetLink = `${normalizeBaseUrl(frontendUrl)}/reset-password?token=${token}`;

  // Direct console log for developer testing without setup
  console.log(`\n==================================================`);
  console.log(`✉️ [EMAIL SIMULATOR] RinoAsist`);
  console.log(`Para: ${toEmail} (${userName})`);
  console.log(`Enlace de restablecimiento: ${resetLink}`);
  console.log(`==================================================\n`);

  if (!transporter) {
    console.warn("⚠️ Nodemailer no enviado: GMAIL_USER o GMAIL_PASS faltantes en .env. Se usó simulación por consola.");
    return { message: "Simulación exitosa por consola", simulated: true };
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restablecer Contraseña - RinoAsist</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #0f172a;">
  <div style="width: 100%; background-color: #f8fafc; padding: 40px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <div style="background-color: #0052cc; padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 2px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">RinoAsist</h1>
      </div>
      <div style="padding: 40px 30px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <h2 style="font-size: 20px; font-weight: 700; margin-top: 0; color: #0f172a; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Hola, ${userName}:</h2>
        <p style="font-size: 15px; color: #475569; margin-bottom: 24px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>RinoAsist</strong>.</p>
        <p style="font-size: 15px; color: #475569; margin-bottom: 24px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Para continuar con el proceso, haz clic en el siguiente botón:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <!-- Outlook Bulletproof Table Button -->
          <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              <td align="center" bgcolor="#0052cc" style="border-radius: 12px;">
                <a href="${resetLink}" target="_blank" style="display: inline-block; padding: 14px 28px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none; border-radius: 12px; background-color: #0052cc; border: 1px solid #0052cc;">Restablecer Contraseña</a>
              </td>
            </tr>
          </table>
        </div>
        
        <p style="font-size: 13px; color: #64748b; margin-top: 24px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;"><em>Nota: Este enlace es de uso único y expirará automáticamente en 1 hora por seguridad.</em></p>
        
        <div style="border-top: 1px solid #e2e8f0; margin: 24px 0;"></div>
        
        <p style="font-size: 13px; color: #64748b; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Si tú no realizaste esta solicitud, puedes ignorar este mensaje sin problemas. Tu cuenta sigue estando protegida.</p>
      </div>
      <div style="background-color: #f1f5f9; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">© 2026 RinoAsist. Control de Asistencias Escolar.</p>
        <p style="margin: 0; font-size: 11px; color: #94a3b8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Mensaje enviado de forma automatizada por el sistema. Por favor no responder a este correo.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"Soporte RinoAsist" <${GMAIL_USER}>`,
    to: toEmail,
    subject: "Restablecer tu contraseña - RinoAsist",
    html: htmlContent,
  };

  return transporter.sendMail(mailOptions);
};

/**
 * Sends a student registration invitation email.
 * @param {string} toEmail - Recipient email
 * @param {string} groupName - Assigned group clave
 * @param {string} token - Invitation token
 */
export const sendInvitationEmail = async (toEmail, groupName, token, frontendUrl = FRONTEND_URL) => {
  const registerLink = `${normalizeBaseUrl(frontendUrl)}/register?token=${token}`;

  console.log(`\n==================================================`);
  console.log(`✉️ [EMAIL SIMULATOR] RinoAsist - Invitación de Alumno`);
  console.log(`Para: ${toEmail}`);
  console.log(`Grupo asignado: ${groupName}`);
  console.log(`Enlace de registro: ${registerLink}`);
  console.log(`==================================================\n`);

  if (!transporter) {
    console.warn("⚠️ Nodemailer no enviado: GMAIL_USER o GMAIL_PASS faltantes en .env. Se usó simulación por consola.");
    return { message: "Simulación exitosa por consola", simulated: true };
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitación a RinoAsist</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #0f172a;">
  <div style="width: 100%; background-color: #f8fafc; padding: 40px 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <div style="background-color: #0052cc; padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 2px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">RinoAsist</h1>
      </div>
      <div style="padding: 40px 30px; line-height: 1.6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <h2 style="font-size: 20px; font-weight: 700; margin-top: 0; color: #0f172a; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Hola, futuro Rinoceronte:</h2>
        <p style="font-size: 15px; color: #475569; margin-bottom: 24px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Has sido invitado a unirte a la plataforma de registro de asistencias <strong>RinoAsist</strong> para tu grupo asignado <strong>${groupName}</strong>.</p>
        <p style="font-size: 15px; color: #475569; margin-bottom: 24px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Para completar tu registro y vincularte con tus materias de este ciclo escolar, por favor haz clic en el siguiente botón:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <!-- Outlook Bulletproof Table Button -->
          <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              <td align="center" bgcolor="#0052cc" style="border-radius: 12px;">
                <a href="${registerLink}" target="_blank" style="display: inline-block; padding: 14px 28px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none; border-radius: 12px; background-color: #0052cc; border: 1px solid #0052cc;">Completar Registro</a>
              </td>
            </tr>
          </table>
        </div>
        
        <p style="font-size: 13px; color: #64748b; margin-top: 24px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;"><em>Nota: Este enlace de invitación es único y expirará automáticamente en 24 horas por seguridad.</em></p>
      </div>
      <div style="background-color: #f1f5f9; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <p style="margin: 0; font-size: 12px; color: #64748b; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">© 2026 RinoAsist. Control de Asistencias Escolar.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"Soporte RinoAsist" <${GMAIL_USER}>`,
    to: toEmail,
    subject: "Invitación de registro de alumno - RinoAsist",
    html: htmlContent,
  };

  return transporter.sendMail(mailOptions);
};
