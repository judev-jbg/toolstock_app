// backend/src/services/synchronization/productSyncService.js
const Product = require('../../models/productModel');
const amazonService = require('../amazon/productService');
const prestashopService = require('../services/prestashop/productService');
const logger = require('../../utils/logger').createLogger('productSyncService');

class ProductSyncService {
  /**
   * Sincroniza productos desde ERP a Prestashop y Amazon
   * @param {Object} options - Opciones de sincronización
   * @returns {Promise<Object>} Resultado de la sincronización
   */
  async syncProductsFromErp(options = {}) {
    const { onlyActive = true, limit = 100 } = options;

    try {
      logger.info(
        `Iniciando sincronización de productos desde ERP, onlyActive=${onlyActive}, limit=${limit}`
      );

      // Encontrar productos que necesitan sincronización
      // En una implementación real, aquí habría lógica para importar los datos del ERP
      // Por ahora, simulamos con los productos ya en la base de datos
      const filter = onlyActive ? { active: true } : {};

      const products = await Product.find(filter)
        .sort({ lastSyncWithErp: 1 }) // Primero los que llevan más tiempo sin sincronizar
        .limit(limit);

      if (products.length === 0) {
        logger.info('No hay productos para sincronizar');
        return {
          success: true,
          message: 'No hay productos para sincronizar',
          stats: {
            total: 0,
            syncedWithPrestashop: 0,
            syncedWithAmazon: 0,
            errors: 0,
          },
        };
      }

      logger.info(`Encontrados ${products.length} productos para sincronizar`);

      const stats = {
        total: products.length,
        syncedWithPrestashop: 0,
        syncedWithAmazon: 0,
        errors: 0,
        details: [],
      };

      for (const product of products) {
        try {
          const productDetail = {
            sku: product.sku,
            prestashop: { status: 'no_sync', message: '' },
            amazon: { status: 'no_sync', message: '' },
          };

          // Sincronizar con Prestashop si está activo en esa plataforma
          if (product.activeInPrestashop) {
            try {
              await prestashopService.syncProduct(product);
              stats.syncedWithPrestashop++;
              productDetail.prestashop = {
                status: 'success',
                message: 'Sincronizado correctamente',
              };
              product.lastSyncWithPrestashop = new Date();
            } catch (prestashopError) {
              logger.error(
                `Error sincronizando ${product.sku} con Prestashop: ${prestashopError.message}`
              );
              productDetail.prestashop = { status: 'error', message: prestashopError.message };
              stats.errors++;
            }
          }

          // Sincronizar con Amazon si está activo en esa plataforma
          if (product.activeInAmazon) {
            try {
              await amazonService.syncProduct(product);
              stats.syncedWithAmazon++;
              productDetail.amazon = { status: 'success', message: 'Sincronizado correctamente' };
              product.lastSyncWithAmazon = new Date();
            } catch (amazonError) {
              logger.error(`Error sincronizando ${product.sku} con Amazon: ${amazonError.message}`);
              productDetail.amazon = { status: 'error', message: amazonError.message };
              stats.errors++;
            }
          }

          // Actualizar la fecha de sincronización con el ERP
          product.lastSyncWithErp = new Date();
          await product.save();

          stats.details.push(productDetail);
        } catch (error) {
          logger.error(`Error general sincronizando producto ${product.sku}: ${error.message}`);
          stats.errors++;
          stats.details.push({
            sku: product.sku,
            error: error.message,
          });
        }
      }

      logger.info(`Sincronización completada. Estadísticas: ${JSON.stringify(stats)}`);

      return {
        success: true,
        message: 'Sincronización completada',
        stats,
      };
    } catch (error) {
      logger.error(`Error en sincronización de productos: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sincroniza un producto específico con todas las plataformas
   * @param {string} productId - ID del producto
   * @returns {Promise<Object>} Resultado de la sincronización
   */
  async syncProduct(productId) {
    try {
      const product = await Product.findById(productId);

      if (!product) {
        throw new Error('Producto no encontrado');
      }

      const result = {
        sku: product.sku,
        prestashop: { status: 'no_sync', message: '' },
        amazon: { status: 'no_sync', message: '' },
      };

      // Sincronizar con Prestashop si está activo
      if (product.activeInPrestashop) {
        try {
          await prestashopService.syncProduct(product);
          product.lastSyncWithPrestashop = new Date();
          result.prestashop = { status: 'success', message: 'Sincronizado correctamente' };
        } catch (error) {
          logger.error(`Error sincronizando ${product.sku} con Prestashop: ${error.message}`);
          result.prestashop = { status: 'error', message: error.message };
        }
      }

      // Sincronizar con Amazon si está activo
      if (product.activeInAmazon) {
        try {
          await amazonService.syncProduct(product);
          product.lastSyncWithAmazon = new Date();
          result.amazon = { status: 'success', message: 'Sincronizado correctamente' };
        } catch (error) {
          logger.error(`Error sincronizando ${product.sku} con Amazon: ${error.message}`);
          result.amazon = { status: 'error', message: error.message };
        }
      }

      // Actualizar fecha de sincronización
      product.lastSyncWithErp = new Date();
      await product.save();

      return {
        success: true,
        message: 'Producto sincronizado correctamente',
        result,
      };
    } catch (error) {
      logger.error(`Error sincronizando producto: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new ProductSyncService();
