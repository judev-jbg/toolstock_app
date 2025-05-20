const nodemailer = require('nodemailer');
const logger = require('./logger').createLogger('emailService');

// Configuración del transporte de correo
let transporter;

// Inicializar el transporte según el entorno
const initTransporter = () => {
  if (process.env.NODE_ENV === 'production') {
    // Configuración para producción (SMTP real)
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  } else {
    // Configuración para desarrollo (ethereal.email)
    nodemailer.createTestAccount().then((testAccount) => {
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      logger.info(`Created test email account: ${testAccount.user}`);
    });
  }
};

// Inicializar el transporte
initTransporter();

/**
 * Envía un correo electrónico
 * @param {Object} options - Opciones del correo
 * @param {string} options.to - Destinatario
 * @param {string} options.subject - Asunto
 * @param {string} options.html - Contenido HTML
 * @returns {Promise<Object>} - Resultado del envío
 */
const sendEmail = async (options) => {
  try {
    // Asegurar que el transporte esté inicializado
    if (!transporter) {
      logger.error('Email transporter not initialized');
      throw new Error('Email service not available');
    }

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Toolstock'}" <${process.env.EMAIL_FROM || 'noreply@toolstock.local'}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    };

    const info = await transporter.sendMail(mailOptions);

    // Para desarrollo, mostrar la URL de prueba
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }

    return info;
  } catch (error) {
    logger.error(`Error sending email: ${error.message}`);
    throw error;
  }
};

/**
 * Genera una plantilla de correo para reseteo de contraseña
 * @param {string} name - Nombre del usuario
 * @param {string} resetUrl - URL para resetear la contraseña
 * @returns {string} - HTML del correo
 */
const getPasswordResetTemplate = (name, resetUrl) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Restablecimiento de Contraseña</h2>
      <p>Hola ${name},</p>
      <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
      <p style="margin: 20px 0;">
        <a href="${resetUrl}" style="background-color: #ffc390; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Restablecer Contraseña
        </a>
      </p>
      <p>Este enlace es válido por 1 hora y solo puede utilizarse una vez.</p>
      <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
      <p>Saludos,<br>Equipo de Toolstock</p>
    </div>
  `;
};

/**
 * Genera una plantilla de correo para nueva cuenta
 * @param {string} name - Nombre del usuario
 * @param {string} activationUrl - URL para activar la cuenta
 * @returns {string} - HTML del correo
 */
const getNewAccountTemplate = (name, activationUrl) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Bienvenido a Toolstock</h2>
      <p>Hola ${name},</p>
      <p>Se ha creado una cuenta para ti en el sistema de gestión de Toolstock. Para activar tu cuenta y establecer tu contraseña, por favor haz clic en el siguiente enlace:</p>
      <p style="margin: 20px 0;">
        <a href="${activationUrl}" style="background-color: #ffc390; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Activar Cuenta
        </a>
      </p>
      <p>Este enlace es válido por 24 horas y solo puede utilizarse una vez.</p>
      <p>Saludos,<br>Equipo de Toolstock</p>
    </div>
  `;
};

module.exports = {
  sendEmail,
  getPasswordResetTemplate,
  getNewAccountTemplate,
};
