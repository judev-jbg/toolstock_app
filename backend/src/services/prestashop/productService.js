// backend/src/services/prestashop/productService.js
const psApiClient = require('./psApiClient');

/**
 * Servicio para integración de productos con Prestashop
 */
class PrestashopProductService {
  /**
   * Sincroniza un producto con Prestashop
   * @param {Object} product - Producto a sincronizar
   * @returns {Promise<Object>} Resultado de la sincronización
   */
  async syncProduct(product) {
    try {
      // Verificar que los campos obligatorios estén completos
      if (!product.name || !product.description) {
        throw new Error('Faltan campos obligatorios (nombre, descripción)');
      }

      // Calcular precio para Prestashop (4% menos que Amazon)
      const prestashopPrice = product.amazonPrice
        ? parseFloat((product.amazonPrice * 0.96).toFixed(2))
        : product.minPrice;

      // Buscar si ya existe en Prestashop por SKU
      const existingProduct = await this.findProductBySku(product.sku);

      if (existingProduct) {
        // Actualizar producto existente
        return this.updatePrestashopProduct(existingProduct.id, {
          name: product.name,
          description: product.description,
          price: prestashopPrice,
          active: product.activeInPrestashop ? 1 : 0,
        });
      } else {
        // Crear nuevo producto
        return this.createPrestashopProduct({
          name: product.name,
          description: product.description,
          price: prestashopPrice,
          active: product.activeInPrestashop ? 1 : 0,
          reference: product.sku,
        });
      }
    } catch (error) {
      console.error('Error sincronizando producto con Prestashop:', error);
      throw error;
    }
  }

  /**
   * Busca un producto en Prestashop por SKU
   * @param {string} sku - SKU del producto
   * @returns {Promise<Object>} Producto encontrado o null
   */
  async findProductBySku(sku) {
    try {
      // Usar API de Prestashop para buscar producto por referencia (SKU)
      const response = await psApiClient.get('products', {
        filter: `[reference]=${sku}`,
        display: 'full',
      });

      if (response && response.products && response.products.product) {
        if (Array.isArray(response.products.product)) {
          return response.products.product[0];
        }
        return response.products.product;
      }

      return null;
    } catch (error) {
      console.error('Error buscando producto en Prestashop:', error);
      throw error;
    }
  }

  /**
   * Crea un nuevo producto en Prestashop
   * @param {Object} productData - Datos del producto
   * @returns {Promise<Object>} Resultado de la creación
   */
  async createPrestashopProduct(productData) {
    try {
      // Preparar datos para API de Prestashop
      const productXml = {
        prestashop: {
          product: {
            name: {
              language: {
                '@id': '1', // ID para español
                '#text': productData.name,
              },
            },
            description: {
              language: {
                '@id': '1',
                '#text': productData.description,
              },
            },
            price: productData.price,
            reference: productData.reference,
            active: productData.active,
          },
        },
      };

      // Usar API de Prestashop para crear producto
      const response = await psApiClient.create('products', productXml);

      return {
        success: true,
        message: 'Producto creado en Prestashop',
        product: response,
      };
    } catch (error) {
      console.error('Error creando producto en Prestashop:', error);
      throw error;
    }
  }

  /**
   * Actualiza un producto existente en Prestashop
   * @param {number} id - ID del producto en Prestashop
   * @param {Object} productData - Datos a actualizar
   * @returns {Promise<Object>} Resultado de la actualización
   */
  async updatePrestashopProduct(id, productData) {
    try {
      // Preparar datos para API de Prestashop
      const productXml = {
        prestashop: {
          product: {
            id,
            name: {
              language: {
                '@id': '1',
                '#text': productData.name,
              },
            },
            description: {
              language: {
                '@id': '1',
                '#text': productData.description,
              },
            },
            price: productData.price,
            active: productData.active,
          },
        },
      };

      // Usar API de Prestashop para actualizar producto
      const response = await psApiClient.update('products', id, productXml);

      return {
        success: true,
        message: 'Producto actualizado en Prestashop',
        product: response,
      };
    } catch (error) {
      console.error('Error actualizando producto en Prestashop:', error);
      throw error;
    }
  }
}

module.exports = new PrestashopProductService();
