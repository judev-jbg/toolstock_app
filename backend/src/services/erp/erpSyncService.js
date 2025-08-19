// backend/src/services/erp/erpSyncService.js
const sqlServerService = require('./sqlServerService');
const Product = require('../../models/productModel');
const logger = require('../../utils/logger');

class ErpSyncService {
  constructor() {
    this.syncInProgress = false;
  }

  /**
   * Sincroniza productos de SQL Server a MongoDB
   */
  async syncProducts() {
    if (this.syncInProgress) {
      logger.warn('ERP sync already in progress, skipping...');
      return { skipped: true, message: 'Sync already in progress' };
    }

    try {
      this.syncInProgress = true;
      logger.info('Starting ERP product synchronization...');

      const startTime = Date.now();

      // 1. Obtener productos actualizados de SQL Server
      const erpProducts = await sqlServerService.getUpdatedProducts(65);

      if (!erpProducts || erpProducts.length === 0) {
        logger.info('No updated ERP products found');
        return {
          success: true,
          processed: 0,
          created: 0,
          updated: 0,
          errors: 0,
          duration: Date.now() - startTime,
        };
      }

      logger.info(`Found ${erpProducts.length} updated ERP products to process`);

      const results = {
        processed: 0,
        created: 0,
        updated: 0,
        errors: 0,
        errorDetails: [],
      };

      // 2. Procesar cada producto
      for (const erpProduct of erpProducts) {
        try {
          await this.syncSingleProduct(erpProduct, results);
        } catch (error) {
          results.errors++;
          results.errorDetails.push({
            erp_sku: erpProduct.erp_sku,
            error: error.message,
          });
          logger.error(`Error syncing product ${erpProduct.erp_sku}:`, error.message);
        }
      }

      const duration = Date.now() - startTime;

      logger.info('ERP synchronization completed:', {
        ...results,
        duration: `${duration}ms`,
        errorDetails: results.errorDetails.length,
      });

      return {
        success: true,
        ...results,
        duration,
      };
    } catch (error) {
      logger.error('Fatal error in ERP synchronization:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sincroniza un producto individual
   */
  async syncSingleProduct(erpProduct, results) {
    if (!erpProduct.erp_sku) {
      throw new Error('erp_sku is required');
    }

    // Buscar producto existente
    const existingProduct = await Product.findOne({ erp_sku: erpProduct.erp_sku });

    if (existingProduct) {
      // Verificar si hay cambios
      const hasChanges = this.detectChanges(existingProduct, erpProduct);

      if (hasChanges) {
        await this.updateProduct(existingProduct, erpProduct);
        results.updated++;
        logger.debug(`Updated product: ${erpProduct.erp_sku}`);
      } else {
        logger.debug(`No changes detected for product: ${erpProduct.erp_sku}`);
      }
    } else {
      // Crear nuevo producto
      await this.createProduct(erpProduct);
      results.created++;
      logger.debug(`Created product: ${erpProduct.erp_sku}`);
    }

    results.processed++;
  }

  /**
   * Detecta si hay cambios entre el producto existente y los datos ERP
   */
  detectChanges(existingProduct, erpProduct) {
    const fieldsToCompare = [
      'erp_skuSuplier',
      'erp_name',
      'erp_manufacturer',
      'erp_stock',
      'erp_price_web_official',
      'erp_price_amz_es',
      'erp_price_amz_de',
      'erp_price_amz_it',
      'erp_price_amz_nl',
      'erp_price_amz_be',
      'erp_cost',
      'erp_barcode',
      'erp_obs',
      'erp_offer_web',
      'erp_status',
      'erp_weight',
      'erp_length',
      'erp_height',
      'erp_depth',
    ];

    for (const field of fieldsToCompare) {
      const existingValue = existingProduct[field];
      const newValue = erpProduct[field];

      // Comparar teniendo en cuenta diferentes tipos de datos
      if (this.normalizeValue(existingValue) !== this.normalizeValue(newValue)) {
        logger.debug(`Change detected in ${field}: ${existingValue} → ${newValue}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Normaliza valores para comparación
   */
  normalizeValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return value.trim();
    return String(value).trim();
  }

  /**
   * Actualiza un producto existente con datos ERP
   */
  async updateProduct(existingProduct, erpProduct) {
    const updateData = {
      // Datos ERP
      erp_skuSuplier: erpProduct.erp_skuSuplier || '',
      erp_name: erpProduct.erp_name || '',
      erp_manufacturer: erpProduct.erp_manufacturer || '',
      erp_stock: erpProduct.erp_stock || 0,
      erp_price_web_official: erpProduct.erp_price_web_official || 0,
      erp_price_amz_es: erpProduct.erp_price_amz_es || 0,
      erp_price_amz_de: erpProduct.erp_price_amz_de || 0,
      erp_price_amz_it: erpProduct.erp_price_amz_it || 0,
      erp_price_amz_nl: erpProduct.erp_price_amz_nl || 0,
      erp_price_amz_be: erpProduct.erp_price_amz_be || 0,
      erp_cost: erpProduct.erp_cost || 0,
      erp_barcode: erpProduct.erp_barcode || '',
      erp_obs: erpProduct.erp_obs || '',
      erp_offer_web: erpProduct.erp_offer_web || 0,
      erp_status: erpProduct.erp_status || 0,
      erp_weight: erpProduct.erp_weight || 0,
      erp_length: erpProduct.erp_length || 0,
      erp_height: erpProduct.erp_height || 0,
      erp_depth: erpProduct.erp_depth || 0,

      // Metadatos de sincronización
      erp_lastSyncAt: new Date(),
      erp_syncStatus: 'synced',
      erp_syncError: '',
    };

    await Product.findByIdAndUpdate(existingProduct._id, updateData);
  }

  /**
   * Crea un nuevo producto con datos ERP
   */
  async createProduct(erpProduct) {
    const productData = {
      // Campo único requerido
      erp_sku: erpProduct.erp_sku,

      // Datos ERP
      erp_skuSuplier: erpProduct.erp_skuSuplier || '',
      erp_name: erpProduct.erp_name || '',
      erp_manufacturer: erpProduct.erp_manufacturer || '',
      erp_stock: erpProduct.erp_stock || 0,
      erp_price_web_official: erpProduct.erp_price_web_official || 0,
      erp_price_amz_es: erpProduct.erp_price_amz_es || 0,
      erp_price_amz_de: erpProduct.erp_price_amz_de || 0,
      erp_price_amz_it: erpProduct.erp_price_amz_it || 0,
      erp_price_amz_nl: erpProduct.erp_price_amz_nl || 0,
      erp_price_amz_be: erpProduct.erp_price_amz_be || 0,
      erp_cost: erpProduct.erp_cost || 0,
      erp_barcode: erpProduct.erp_barcode || '',
      erp_obs: erpProduct.erp_obs || '',
      erp_offer_web: erpProduct.erp_offer_web || 0,
      erp_status: erpProduct.erp_status || 0,
      erp_weight: erpProduct.erp_weight || 0,
      erp_length: erpProduct.erp_length || 0,
      erp_height: erpProduct.erp_height || 0,
      erp_depth: erpProduct.erp_depth || 0,

      // Metadatos de sincronización
      erp_lastSyncAt: new Date(),
      erp_syncStatus: 'synced',
      erp_syncError: '',

      // Campos Amazon vacíos (se llenarán con la sincronización de Amazon)
      amz_asin: '',
      amz_sellerSku: '',
      amz_title: '',
      amz_brand: '',
      amz_price: 0,
      amz_currency: 'EUR',
      amz_quantity: 0,
      amz_status: '',
      amz_condition: '',
      amz_fulfillmentChannel: '',
      amz_productType: '',
      amz_imageUrl: '',
      amz_syncStatus: 'pending',
    };

    await Product.create(productData);
  }

  /**
   * Obtiene estadísticas de la última sincronización
   */
  async getSyncStats() {
    try {
      const stats = {
        totalProducts: await Product.countDocuments({ erp_sku: { $exists: true, $ne: '' } }),
        syncedToday: await Product.countDocuments({
          erp_lastSyncAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        }),
        pendingSync: await Product.countDocuments({
          $or: [{ erp_syncStatus: 'pending' }, { erp_syncStatus: 'error' }],
        }),
        lastSyncTime: await Product.findOne(
          { erp_lastSyncAt: { $exists: true } },
          { erp_lastSyncAt: 1 }
        ).sort({ erp_lastSyncAt: -1 }),
      };

      return stats;
    } catch (error) {
      logger.error('Error getting sync stats:', error);
      throw error;
    }
  }
}

module.exports = new ErpSyncService();
