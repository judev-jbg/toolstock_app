/**
 * Helper para verificar y validar la configuración de Amazon SP-API
 */

const logger = require('./logger').createLogger('amazonConfig');

/**
 * Verifica que todas las variables de entorno necesarias estén configuradas
 */
function checkAmazonConfig() {
  const requiredVars = [
    'AMAZON_MARKETPLACE_ID',
    'AMAZON_SELLER_ID',
    'AMAZON_REGION',
    'SELLING_PARTNER_APP_CLIENT_ID',
    'SELLING_PARTNER_APP_CLIENT_SECRET',
    'AMAZON_REFRESH_TOKEN',
  ];

  const missingVars = [];
  const configStatus = {};

  requiredVars.forEach((varName) => {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      missingVars.push(varName);
      configStatus[varName] = 'MISSING';
    } else {
      configStatus[varName] = 'OK';
    }
  });

  return {
    isValid: missingVars.length === 0,
    missingVars,
    configStatus,
  };
}

/**
 * Obtiene la configuración actual de Amazon
 */
function getAmazonConfig() {
  return {
    marketplaceId: process.env.AMAZON_MARKETPLACE_ID,
    sellerId: process.env.AMAZON_SELLER_ID,
    region: process.env.AMAZON_REGION,
    clientId: process.env.SELLING_PARTNER_APP_CLIENT_ID ? 'SET' : 'NOT SET',
    clientSecret: process.env.SELLING_PARTNER_APP_CLIENT_SECRET ? 'SET' : 'NOT SET',
    refreshToken: process.env.AMAZON_REFRESH_TOKEN ? 'SET' : 'NOT SET',
  };
}

/**
 * Valida el formato de las variables de configuración
 */
function validateAmazonConfig() {
  const config = getAmazonConfig();
  const errors = [];

  // Validar Marketplace ID (debe ser como A1RKKUPIHCS9HS)
  if (config.marketplaceId && !/^A[0-9A-Z]{13}$/.test(config.marketplaceId)) {
    errors.push('AMAZON_MARKETPLACE_ID debe tener formato A1RKKUPIHCS9HS (España) o similar');
  }

  // Validar Seller ID (debe ser alfanumérico)
  if (config.sellerId && !/^[A-Z0-9]+$/.test(config.sellerId)) {
    errors.push('AMAZON_SELLER_ID debe ser alfanumérico');
  }

  // Validar región
  const validRegions = ['eu', 'na', 'fe'];
  if (config.region && !validRegions.includes(config.region)) {
    errors.push(`AMAZON_REGION debe ser uno de: ${validRegions.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Muestra el estado de la configuración en la consola
 */
function logConfigStatus() {
  const configCheck = checkAmazonConfig();
  const configValidation = validateAmazonConfig();

  console.log('\n🔧 Estado de configuración Amazon SP-API:');
  console.table(configCheck.configStatus);

  if (!configCheck.isValid) {
    console.log('\n❌ Variables faltantes:');
    configCheck.missingVars.forEach((varName) => {
      console.log(`  - ${varName}`);
    });
  }

  if (!configValidation.isValid) {
    console.log('\n⚠️  Errores de formato:');
    configValidation.errors.forEach((error) => {
      console.log(`  - ${error}`);
    });
  }

  if (configCheck.isValid && configValidation.isValid) {
    console.log('\n✅ Configuración de Amazon SP-API correcta');
  }

  return configCheck.isValid && configValidation.isValid;
}

/**
 * Mapeo de regiones y marketplaces comunes
 */
const MARKETPLACE_REGIONS = {
  // Europa
  A1RKKUPIHCS9HS: { country: 'España', region: 'eu' },
  A1PA6795UKMFR9: { country: 'Alemania', region: 'eu' },
  A13V1IB3VIYZZH: { country: 'Francia', region: 'eu' },
  APJ6JRA9NG5V4: { country: 'Italia', region: 'eu' },
  A1F83G8C2ARO7P: { country: 'Reino Unido', region: 'eu' },

  // Norte América
  ATVPDKIKX0DER: { country: 'Estados Unidos', region: 'na' },
  A2EUQ1WTGCTBG2: { country: 'Canadá', region: 'na' },
  A1AM78C64UM0Y8: { country: 'México', region: 'na' },

  // Asia-Pacífico
  A1VC38T7YXB528: { country: 'Japón', region: 'fe' },
  AAHKV2X7AFYLW: { country: 'China', region: 'fe' },
  A39IBJ37TRP1C6: { country: 'Australia', region: 'fe' },
};

/**
 * Obtiene información del marketplace basado en el ID
 */
function getMarketplaceInfo(marketplaceId) {
  return (
    MARKETPLACE_REGIONS[marketplaceId] || {
      country: 'Desconocido',
      region: 'unknown',
    }
  );
}

module.exports = {
  checkAmazonConfig,
  getAmazonConfig,
  validateAmazonConfig,
  logConfigStatus,
  getMarketplaceInfo,
  MARKETPLACE_REGIONS,
};
