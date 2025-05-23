const spApiClient = require('./spApiClient');
const Product = require('../../models/productModel');
const logger = require('../../utils/logger').createLogger('simpleAmazonService');

class SimpleAmazonService {
  constructor() {
    this.marketplaceId = process.env.AMAZON_MARKETPLACE_ID || 'A1RKKUPIHCS9HS'; // España
  }

  /**
   * Obtiene todos los productos del inventario FBA de Amazon
   */
  async getFBAInventory() {
    try {
      const result = await spApiClient.executeWithRetry(async (client) => {
        const response = await client.callAPI({
          operation: 'getInventorySummaries',
          endpoint: 'fbaInventory',
          query: {
            granularityType: 'Marketplace',
            granularityId: this.marketplaceId,
            marketplaceIds: [this.marketplaceId],
          },
        });
        return response;
      });

      logger.info(`Retrieved ${result.inventorySummaries?.length || 0} FBA inventory items`);
      return result.inventorySummaries || [];
    } catch (error) {
      logger.error('Error getting FBA inventory:', error);
      return [];
    }
  }

  /**
   * Obtiene el inventario MFN usando reportes (alternativa más confiable)
   */
  async getMFNInventoryReport() {
    try {
      // Usar el endpoint de reportes para obtener inventario MFN
      const result = await spApiClient.executeWithRetry(async (client) => {
        const response = await client.callAPI({
          operation: 'createReport',
          endpoint: 'reports',
          body: {
            reportType: 'GET_MERCHANT_LISTINGS_ALL_DATA',
            marketplaceIds: [this.marketplaceId],
          },
        });
        return response;
      });

      logger.info('MFN inventory report requested:', result.reportId);
      return result;
    } catch (error) {
      logger.error('Error requesting MFN inventory report:', error);
      return null;
    }
  }

  /**
   * Sincroniza productos usando solo FBA inventory (más confiable)
   */
  async syncProductsSimple() {
    try {
      logger.info('Starting simple product synchronization...');

      // Solo obtener inventario FBA por ahora
      const fbaItems = await this.getFBAInventory();

      if (fbaItems.length === 0) {
        logger.warn('No FBA inventory items found');
        return {
          created: 0,
          updated: 0,
          errors: 0,
          message: 'No se encontraron productos en inventario FBA',
        };
      }

      const syncResults = {
        created: 0,
        updated: 0,
        errors: 0,
      };

      for (const item of fbaItems) {
        try {
          const productData = this.mapFBAItemToProduct(item);

          // Actualizar o crear producto
          const result = await Product.findOneAndUpdate(
            { sellerSku: item.sellerSku },
            {
              ...productData,
              lastSyncAt: new Date(),
              syncStatus: 'synced',
              syncError: '',
            },
            {
              upsert: true,
              new: true,
              setDefaultsOnInsert: true,
            }
          );

          if (result.upserted) {
            syncResults.created++;
          } else {
            syncResults.updated++;
          }
        } catch (error) {
          logger.error(`Error syncing product ${item.sellerSku}:`, error);
          syncResults.errors++;

          // Marcar producto con error
          try {
            await Product.findOneAndUpdate(
              { sellerSku: item.sellerSku },
              {
                sellerSku: item.sellerSku,
                asin: item.asin || '',
                title: item.productName || item.sellerSku,
                syncStatus: 'error',
                syncError: error.message,
                lastSyncAt: new Date(),
              },
              { upsert: true }
            );
          } catch (dbError) {
            logger.error(`Error saving error state for ${item.sellerSku}:`, dbError);
          }
        }
      }

      logger.info('Simple product synchronization completed:', syncResults);
      return syncResults;
    } catch (error) {
      logger.error('Error in simple product synchronization:', error);
      throw error;
    }
  }

  /**
   * Mapea un item de inventario FBA a nuestro formato de producto
   */
  mapFBAItemToProduct(fbaItem) {
    return {
      asin: fbaItem.asin || '',
      sellerSku: fbaItem.sellerSku,
      title: fbaItem.productName || fbaItem.sellerSku,
      brand: this.extractBrandFromTitle(fbaItem.productName || ''),
      quantity: fbaItem.totalQuantity || 0,
      condition: fbaItem.condition || 'New',
      fulfillmentChannel: 'AFN', // FBA
      status: this.determineProductStatus(fbaItem),
      price: 0, // Se puede actualizar después con otros endpoints
      currency: 'EUR',
      productType: 'physical',
      amazonData: {
        itemName: fbaItem.productName || '',
        fnsku: fbaItem.fnsku || '',
        reservedQuantity: fbaItem.reservedQuantity || 0,
        inboundWorkingQuantity: fbaItem.inboundWorkingQuantity || 0,
        inboundShippedQuantity: fbaItem.inboundShippedQuantity || 0,
        inboundReceivingQuantity: fbaItem.inboundReceivingQuantity || 0,
      },
    };
  }

  /**
   * Determina el estado del producto
   */
  determineProductStatus(fbaItem) {
    // Si no tiene ASIN o nombre, está incompleto
    if (!fbaItem.asin || !fbaItem.productName) {
      return 'Incomplete';
    }

    // Si tiene stock disponible, está activo
    if (fbaItem.totalQuantity > 0) {
      return 'Active';
    }

    // Si no tiene stock pero tiene información completa, está inactivo
    return 'Inactive';
  }

  /**
   * Extrae la marca del título (heurística simple)
   */
  extractBrandFromTitle(title) {
    if (!title) return '';

    // Limpiar el título y tomar la primera palabra como marca potencial
    const cleanTitle = title.trim();
    const words = cleanTitle.split(/[\s\-\,]+/);

    // Filtrar palabras comunes que no son marcas
    const commonWords = ['the', 'and', 'for', 'with', 'pack', 'set', 'kit'];
    const potentialBrand = words.find(
      (word) => word.length > 2 && !commonWords.includes(word.toLowerCase()) && isNaN(word)
    );

    return potentialBrand || words[0] || '';
  }

  /**
   * Actualización simple de stock (solo local por ahora)
   */
  async updateProductStockLocal(sellerSku, quantity) {
    try {
      const result = await Product.findOneAndUpdate(
        { sellerSku },
        {
          quantity,
          lastInventoryUpdate: new Date(),
        },
        { new: true }
      );

      if (!result) {
        throw new Error('Producto no encontrado');
      }

      logger.info(`Updated local stock for SKU ${sellerSku} to ${quantity}`);
      return result;
    } catch (error) {
      logger.error(`Error updating local stock for SKU ${sellerSku}:`, error);
      throw error;
    }
  }

  /**
   * Actualización masiva de stock (solo local)
   */
  async bulkUpdateStockLocal(updates) {
    const results = {
      success: [],
      errors: [],
    };

    for (const update of updates) {
      try {
        await this.updateProductStockLocal(update.sellerSku, update.quantity);
        results.success.push({
          sellerSku: update.sellerSku,
          quantity: update.quantity,
        });
      } catch (error) {
        results.errors.push({
          sellerSku: update.sellerSku,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Obtiene endpoints disponibles para debugging
   */
  async getAvailableEndpoints() {
    try {
      const client = await spApiClient.getClient();
      const endpoints = {};

      Object.entries(client.endpoints).forEach(([name, config]) => {
        endpoints[name] = {
          version: config.version || 'unknown',
          operations: config.operations ? Object.keys(config.operations) : [],
        };
      });

      return endpoints;
    } catch (error) {
      logger.error('Error getting endpoints:', error);
      throw error;
    }
  }
}

module.exports = new SimpleAmazonService();
