const SellingPartner = require('amazon-sp-api');
const logger = require('../../utils/logger');

/**
 * Cliente para conexión con Amazon SP-API
 */
class SpApiClient {
  constructor() {
    this.clientPromise = null;
    this.initClient();
  }

  /**
   * Inicializa el cliente SP-API
   */
  initClient() {
    try {
      // Crear una nueva instancia del cliente según la documentación
      this.clientPromise = Promise.resolve(
        new SellingPartner({
          region: process.env.AMAZON_REGION || 'eu', // La región para los endpoints de SP-API
          refresh_token: process.env.AMAZON_REFRESH_TOKEN, // El refresh token del usuario de tu app
          // Opcional: credenciales directamente si no están en env vars
          credentials: {
            SELLING_PARTNER_APP_CLIENT_ID: process.env.SELLING_PARTNER_APP_CLIENT_ID,
            SELLING_PARTNER_APP_CLIENT_SECRET: process.env.SELLING_PARTNER_APP_CLIENT_SECRET,
          },
        })
      );
      logger.info('Amazon SP-API client initialized');
    } catch (error) {
      logger.error('Error initializing Amazon SP-API client:', error);
      throw error;
    }
  }

  /**
   * Obtiene el cliente inicializado
   * @returns {Promise<SellingPartner>} Cliente inicializado
   */
  async getClient() {
    return this.clientPromise;
  }

  /**
   * Ejecuta una operación SP-API con reintentos
   * @param {Function} operation - Función a ejecutar con el cliente
   * @param {number} maxRetries - Número máximo de reintentos
   * @returns {Promise<any>} Resultado de la operación
   */
  async executeWithRetry(operation, maxRetries = 3) {
    let lastError;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        const client = await this.getClient();
        return await operation(client);
      } catch (error) {
        lastError = error;
        logger.error(`SP-API request failed (attempt ${retryCount + 1}/${maxRetries}):`, error);

        // Si el error es de token, reinicializar el cliente
        if (error.statusCode === 401 || (error.message && error.message.includes('token'))) {
          logger.info('Auth error detected, reinitializing client...');
          this.initClient();
        }

        retryCount++;
        // Esperar antes de reintentar (exponential backoff)
        if (retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}

// Exportar una instancia singleton
module.exports = new SpApiClient();
