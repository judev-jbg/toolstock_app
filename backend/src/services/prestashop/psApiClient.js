const axios = require('axios');
const xml2js = require('xml2js');
const logger = require('../../utils/logger');

/**
 * Cliente para la WebService API de PrestaShop
 */
class PrestashopApiClient {
  constructor() {
    this.baseUrl = process.env.PRESTASHOP_API_URL;
    this.apiKey = process.env.PRESTASHOP_API_KEY;
    this.parser = new xml2js.Parser({ explicitArray: false });
    this.builder = new xml2js.Builder();

    // Comprobar configuración al iniciar
    if (!this.baseUrl || !this.apiKey) {
      console.warn(
        'PrestaShop API configuration missing. Set PRESTASHOP_API_URL and PRESTASHOP_API_KEY in .env'
      );
    }
  }

  /**
   * Ejecuta una solicitud a la API de PrestaShop
   * @param {string} method - Método HTTP
   * @param {string} resource - Recurso a consultar
   * @param {Object} [data] - Datos para enviar (POST/PUT)
   * @param {Object} [params] - Parámetros de consulta
   * @returns {Promise<Object>} Respuesta procesada
   */
  async request(method, resource, data = null, params = {}) {
    try {
      const url = `${this.baseUrl}/${resource}`;

      // Configuración de autenticación y formato
      const config = {
        auth: {
          username: this.apiKey,
          password: '',
        },
        params: {
          ...params,
          output_format: 'JSON', // Preferimos JSON si está disponible
        },
        headers: {
          'Content-Type': data ? 'application/xml' : 'application/json',
        },
      };

      let response;

      // Convertir datos a XML si los hay y el método lo requiere
      if (data && (method === 'POST' || method === 'PUT')) {
        const xmlData = this.builder.buildObject(data);
        response = await axios({
          method,
          url,
          data: xmlData,
          ...config,
        });
      } else {
        response = await axios({
          method,
          url,
          ...config,
        });
      }

      // Procesar respuesta según formato
      if (typeof response.data === 'string' && response.data.trim().startsWith('<')) {
        // Es XML, convertir a objeto JavaScript
        const result = await this.parseXML(response.data);
        return result;
      }

      return response.data;
    } catch (error) {
      logger.error(`Error in PrestaShop API request [${method} ${resource}]:`, error.message);

      // Intentar extraer detalles del error
      if (error.response && error.response.data) {
        if (typeof error.response.data === 'string' && error.response.data.trim().startsWith('<')) {
          try {
            const errorData = await this.parseXML(error.response.data);
            logger.error('PrestaShop API error details:', errorData);
          } catch (parseError) {
            logger.error('Error parsing API error response:', parseError);
          }
        } else {
          logger.error('PrestaShop API error details:', error.response.data);
        }
      }

      throw error;
    }
  }

  /**
   * Analiza una respuesta XML a objeto JavaScript
   * @param {string} xml - Contenido XML
   * @returns {Promise<Object>} Objeto JavaScript
   */
  async parseXML(xml) {
    return new Promise((resolve, reject) => {
      this.parser.parseString(xml, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Obtiene recursos de PrestaShop
   * @param {string} resource - Tipo de recurso (orders, customers, etc.)
   * @param {Object} [filters] - Filtros a aplicar
   * @param {Object} [display] - Campos a mostrar
   * @returns {Promise<Object>} Lista de recursos
   */
  async get(resource, filters = {}, display = {}) {
    const params = {
      ...filters,
      ...display,
    };

    return this.request('GET', resource, null, params);
  }

  /**
   * Obtiene un recurso específico por ID
   * @param {string} resource - Tipo de recurso
   * @param {number} id - ID del recurso
   * @returns {Promise<Object>} Recurso solicitado
   */
  async getById(resource, id) {
    return this.request('GET', `${resource}/${id}`);
  }

  /**
   * Crea un nuevo recurso
   * @param {string} resource - Tipo de recurso
   * @param {Object} data - Datos del recurso
   * @returns {Promise<Object>} Recurso creado
   */
  async create(resource, data) {
    return this.request('POST', resource, data);
  }

  /**
   * Actualiza un recurso existente
   * @param {string} resource - Tipo de recurso
   * @param {number} id - ID del recurso
   * @param {Object} data - Datos a actualizar
   * @returns {Promise<Object>} Recurso actualizado
   */
  async update(resource, id, data) {
    return this.request('PUT', `${resource}/${id}`, data);
  }

  /**
   * Elimina un recurso
   * @param {string} resource - Tipo de recurso
   * @param {number} id - ID del recurso
   * @returns {Promise<Object>} Resultado de la eliminación
   */
  async delete(resource, id) {
    return this.request('DELETE', `${resource}/${id}`);
  }
}

// Exportar una instancia singleton
module.exports = new PrestashopApiClient();
