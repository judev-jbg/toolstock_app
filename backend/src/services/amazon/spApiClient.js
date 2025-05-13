const { SellingPartnerAPI } = require('amazon-sp-api');

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
      this.clientPromise = SellingPartnerAPI.createFromEnv();
      console.log('Amazon SP-API client initialized');
    } catch (error) {
      console.error('Error initializing Amazon SP-API client:', error);
      throw error;
    }
  }

  /**
   * Obtiene el cliente inicializado
   * @returns {Promise<SellingPartnerAPI>} Cliente inicializado
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
        console.error(`SP-API request failed (attempt ${retryCount + 1}/${maxRetries}):`, error);

        // Si el error es de token, reinicializar el cliente
        if (error.statusCode === 401 || (error.message && error.message.includes('token'))) {
          console.log('Auth error detected, reinitializing client...');
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
