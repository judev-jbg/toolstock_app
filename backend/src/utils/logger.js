// backend/src/utils/logger.js

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Crear directorio de logs si no existe
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Crea un logger para un módulo específico
 * @param {string} module - Nombre del módulo
 * @returns {winston.Logger} Logger configurado
 */
const createLogger = (module) => {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss',
      }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    ),
    defaultMeta: { service: module },
    transports: [
      // Escribir logs de nivel 'error' y superiores en 'error.log'
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
      }),
      // Escribir todos los logs en 'combined.log'
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
      }),
      // Logs específicos del módulo
      new winston.transports.File({
        filename: path.join(logDir, `${module}.log`),
      }),
    ],
  });
};

// Si no estamos en producción, también log a consola
if (process.env.NODE_ENV !== 'production') {
  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.printf(
      (info) => `${info.timestamp} ${info.level}: [${info.service}] ${info.message}`
    )
  );

  winston.loggers.add('console', {
    level: 'debug',
    format: consoleFormat,
    transports: [new winston.transports.Console()],
  });
}

module.exports = {
  createLogger,
};
