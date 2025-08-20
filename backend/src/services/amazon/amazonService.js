const spApiClient = require('./spApiClient');
const Product = require('../../models/productModel');
const logger = require('../../utils/logger');

class AmazonService {
  constructor() {
    this.marketplaceId = process.env.AMAZON_MARKETPLACE_ID || 'A1RKKUPIHCS9HS'; // España
    this.sellerId = process.env.AMAZON_SELLER_ID;
  }

  /**
   * Obtiene listings de productos usando el endpoint correcto con paginación completa
   */
  async getAllListingsItems() {
    try {
      if (!this.sellerId) {
        logger.warn('AMAZON_SELLER_ID not configured, skipping listings');
        return [];
      }

      let allItems = [];
      let nextToken = null;
      let pageCount = 0;

      do {
        const result = await spApiClient.executeWithRetry(async (client) => {
          const query = {
            marketplaceIds: [this.marketplaceId],
            pageSize: 20,
            includedData: ['summaries', 'attributes', 'offers', 'fulfillmentAvailability'],
          };

          if (nextToken) {
            query.pageToken = nextToken;
          }

          const response = await client.callAPI({
            operation: 'searchListingsItems',
            endpoint: 'listingsItems',
            path: {
              sellerId: this.sellerId,
            },
            query,
          });
          return response;
        });

        const items = result.items || [];
        allItems = allItems.concat(items);

        nextToken = result.pagination?.nextToken;
        pageCount++;

        logger.info(
          `Page ${pageCount}: Retrieved ${items.length} items (Total: ${allItems.length})`
        );

        if (pageCount > 100) {
          logger.warn('Reached maximum page limit, stopping pagination');
          break;
        }
      } while (nextToken);

      logger.info(`Retrieved total of ${allItems.length} listings items in ${pageCount} pages`);
      return allItems;
    } catch (error) {
      logger.error('Error getting listings items:', error);
      return [];
    }
  }

  /**
   * Mapea un listing a formato de producto (CORREGIDO)
   */
  mapListingToProduct(listing) {
    const summary = listing.summaries?.[0] || {};
    const attributes = listing.attributes || {};
    const offers = listing.offers || [];
    const fulfillmentAvailability = listing.fulfillmentAvailability || [];
    const amz_asin = summary.asin;
    const amz_title = summary.itemName || attributes.item_name?.[0]?.value || listing.sku;
    const amz_brand = attributes.manufacturer?.[0]?.value || attributes.brand?.[0]?.value || '';
    const amz_price = offers?.[0]?.price?.amount || 0;
    const amz_quantity = fulfillmentAvailability?.[0]?.quantity || 0;
    const amz_status = '';
    const amz_imageUrl =
      summary.mainImage?.link || attributes.main_product_image_locator?.[0]?.media_location || '';
    const amz_condition = this.mapConditionType(
      summary.conditionType || attributes.condition_type?.[0]?.value || 'new_new'
    );
    const amz_fulfillmentChannel = this.determineFulfillmentChannel(
      fulfillmentAvailability,
      attributes
    );

    return {
      amz_asin,
      amz_sellerSku: listing.sku,
      amz_title,
      amz_brand,
      amz_quantity,
      amz_condition,
      amz_fulfillmentChannel,
      amz_status,
      amz_price,
      amz_currency: 'EUR',
      amz_productType: summary.productType || attributes.product_type || 'physical',
      amz_imageUrl,
      amz_amazonData: {
        itemName: amz_title,
        listingId: listing.listingId || '',
        productId: summary.productId || '',
        productType: summary.productType || '',
        productIdType: summary.productIdType || '',
        itemCondition: summary.conditionType || 'new_new',
        listingStatus: summary.status || [],
        createdDate: summary.createdDate || '',
        lastUpdatedDate: summary.lastUpdatedDate || '',
        mainImageUrl: amz_imageUrl,
        manufacturer: attributes.manufacturer?.[0]?.value || '',
        ean:
          attributes.externally_assigned_product_identifier?.find((id) => id.type === 'ean')
            ?.value || '',
        upc:
          attributes.externally_assigned_product_identifier?.find((id) => id.type === 'upc')
            ?.value || '',
        material: attributes.material?.[0]?.value || '',
        countryOfOrigin: attributes.country_of_origin?.[0]?.value || '',
      },
    };
  }

  /**
   * Sincroniza productos con la base de datos local (solo productos con ERP SKU coincidente)
   */
  async syncProductsWithDatabase() {
    try {
      logger.info('Starting comprehensive product synchronization...');

      const syncResults = {
        created: 0,
        updated: 0,
        errors: 0,
        skipped: 0,
        sources: {
          listings: 0,
          statusReport: 0,
        },
        unmatchedProducts: [],
      };

      // 1. Obtener productos ERP existentes para comparación
      const erpProducts = await Product.find({}, 'erp_sku').lean();
      const erpSkuSet = new Set(erpProducts.map((p) => p.erp_sku).filter((sku) => sku));

      logger.info(`Found ${erpSkuSet.size} ERP products for matching`);

      // 2. Obtener TODOS los listings de Amazon
      const allListings = await this.getAllListingsItems();
      logger.info(`Processing ${allListings.length} Amazon listings`);

      const unmatchedProducts = [];

      for (const listing of allListings) {
        try {
          const amazonSku = listing.sku;

          // Solo procesar si el SKU de Amazon coincide con algún ERP SKU
          if (erpSkuSet.has(amazonSku)) {
            const productData = this.mapListingToProduct(listing);
            const result = await this.upsertProductWithErpSku(productData, amazonSku);

            if (result.created) {
              syncResults.created++;
            } else {
              syncResults.updated++;
            }
            syncResults.sources.listings++;
          } else {
            // Recopilar productos no coincidentes para CSV
            const summary = listing.summaries?.[0] || {};
            unmatchedProducts.push({
              sku: amazonSku,
              asin: summary.asin || '',
              title: summary.itemName || listing.sku || 'Sin título',
            });
            syncResults.skipped++;
          }
        } catch (error) {
          logger.error(`Error processing listing ${listing.sku}:`, error);
          syncResults.errors++;
        }
      }

      // 3. Generar CSV con productos no coincidentes
      if (unmatchedProducts.length > 0) {
        await this.generateUnmatchedProductsCSV(unmatchedProducts);
        syncResults.unmatchedProducts = unmatchedProducts;
        logger.info(`Generated CSV with ${unmatchedProducts.length} unmatched products`);
      }

      logger.info('Product synchronization completed:', {
        ...syncResults,
        unmatchedProducts: syncResults.unmatchedProducts.length,
      });

      return {
        ...syncResults,
        unmatchedProductsCount: unmatchedProducts.length,
      };
    } catch (error) {
      logger.error('Error in product synchronization:', error);
      throw error;
    }
  }

  /**
   * Upsert de producto manteniendo datos ERP existentes
   */
  async upsertProductWithErpSku(amazonData, erpSku) {
    try {
      // Buscar producto existente por erp_sku
      const existingProduct = await Product.findOne({ erp_sku: erpSku });

      if (existingProduct) {
        // Actualizar solo campos de Amazon, mantener datos ERP
        const updateData = {};
        let hasChanges = false;
        Object.keys(amazonData).forEach((key) => {
          if (key.startsWith('amz_')) {
            const newValue = amazonData[key];
            const currentValue = existingProduct[key];
            if (this.valueHasChanged(currentValue, newValue)) {
              updateData[key] = newValue;
              hasChanges = true;
            }
          }
        });

        if (hasChanges) {
          updateData.amz_lastSyncAt = new Date();
          updateData.amz_syncStatus = 'synced';
          updateData.amz_syncError = '';

          const result = await Product.findByIdAndUpdate(existingProduct._id, updateData, {
            new: true,
          });

          return { product: result, created: false, updated: true };
        } else {
          // No hay cambios, devolver producto existente
          return { product: existingProduct, created: false, updated: false };
        }
      } else {
        // Crear nuevo producto con erp_sku
        const newProductData = {
          ...amazonData,
          erp_sku: erpSku,
          amz_lastSyncAt: new Date(),
          amz_syncStatus: 'synced',
          amz_syncError: '',
        };

        const result = await Product.create(newProductData);
        return { product: result, created: true };
      }
    } catch (error) {
      // Marcar producto con error
      await Product.findOneAndUpdate(
        { erp_sku: erpSku },
        {
          erp_sku: erpSku,
          amz_sellerSku: amazonData.amz_sellerSku || '',
          amz_asin: amazonData.amz_asin || '',
          amz_title: amazonData.amz_title || erpSku,
          amz_syncStatus: 'error',
          amz_syncError: error.message,
          amz_lastSyncAt: new Date(),
        },
        { upsert: true }
      );

      throw error;
    }
  }

  /**
   * Genera un archivo CSV con productos de Amazon no coincidentes
   */
  async generateUnmatchedProductsCSV(unmatchedProducts) {
    try {
      const fs = require('fs');
      const path = require('path');
      const csvDir = path.join(__dirname, '../../../logs');

      // Asegurar que el directorio existe
      if (!fs.existsSync(csvDir)) {
        fs.mkdirSync(csvDir, { recursive: true });
      }

      // Crear contenido CSV
      const csvHeaders = 'SKU,ASIN,Titulo\n';
      const csvRows = unmatchedProducts
        .map(
          (product) => `"${product.sku}","${product.asin}","${product.title.replace(/"/g, '""')}"`
        )
        .join('\n');

      const csvContent = csvHeaders + csvRows;

      // Generar nombre de archivo con timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `productos-amazon-no-coincidentes-${timestamp}.csv`;
      const filepath = path.join(csvDir, filename);

      // Escribir archivo
      fs.writeFileSync(filepath, csvContent, 'utf8');

      logger.info(`Unmatched products CSV generated: ${filepath}`);
      return filepath;
    } catch (error) {
      logger.error('Error generating unmatched products CSV:', error);
      throw error;
    }
  }

  /**
   * Actualiza el stock de un producto en Amazon
   */
  async updateInventoryQuantity(sellerSku, quantity) {
    try {
      if (!this.sellerId) {
        throw new Error('AMAZON_SELLER_ID no configurado');
      }

      logger.info(`Updating inventory for SKU ${sellerSku} to quantity ${quantity}`);

      // Preparar el cuerpo de la solicitud según la API de Amazon
      const requestBody = {
        productType: 'PRODUCT', // Esto puede necesitar ajuste según el tipo de producto
        patches: [
          {
            op: 'replace',
            path: '/attributes/fulfillment_availability',
            value: [
              {
                fulfillment_channel_code: 'DEFAULT',
                quantity: quantity,
              },
            ],
          },
        ],
      };

      // Realizar la llamada a Amazon SP-API
      const result = await spApiClient.executeWithRetry(async (client) => {
        const response = await client.callAPI({
          operation: 'patchListingsItem',
          endpoint: 'listingsItems',
          path: {
            sellerId: this.sellerId,
            sku: sellerSku,
          },
          query: {
            marketplaceIds: [this.marketplaceId],
          },
          body: requestBody,
        });
        return response;
      });

      // Actualizar también en la base de datos local
      const localResult = await Product.findOneAndUpdate(
        { erp_sku: sellerSku },
        {
          amz_quantity: quantity,
          amz_lastInventoryUpdate: new Date(),
          amz_syncStatus: 'synced',
          amz_syncError: '',
        },
        { new: true }
      );

      if (!localResult) {
        throw new Error('Producto no encontrado en base de datos local');
      }

      logger.info(`Successfully updated inventory for SKU ${sellerSku} in Amazon and locally`);

      return {
        amazon: result,
        local: localResult,
        success: true,
      };
    } catch (error) {
      logger.error(`Error updating inventory for SKU ${sellerSku}:`, error);

      // Marcar error en base de datos local
      await Product.findOneAndUpdate(
        { sellerSku },
        {
          syncStatus: 'error',
          syncError: error.message,
          lastInventoryUpdate: new Date(),
        }
      );

      throw error;
    }
  }

  /**
   * Actualiza stock de múltiples productos en Amazon
   */
  async bulkUpdateInventory(updates) {
    const results = {
      success: [],
      errors: [],
    };

    logger.info(`Starting bulk inventory update for ${updates.length} products`);

    // Procesar de 5 en 5 para evitar rate limiting
    const batchSize = 5;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);

      const batchPromises = batch.map(async (update) => {
        try {
          await this.updateInventoryQuantity(update.sellerSku, update.quantity);
          results.success.push({
            sellerSku: update.sellerSku,
            quantity: update.quantity,
            success: true,
          });
        } catch (error) {
          results.errors.push({
            sellerSku: update.sellerSku,
            error: error.message,
            success: false,
          });
        }
      });

      await Promise.all(batchPromises);

      // Pausa entre lotes para evitar rate limiting
      if (i + batchSize < updates.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    logger.info(
      `Bulk inventory update completed: ${results.success.length} successful, ${results.errors.length} failed`
    );
    return results;
  }

  /**
   * Verifica cuántos productos necesitan sincronización
   */
  async checkSyncNeeded() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const count = await Product.countDocuments({
        $or: [
          { lastSyncAt: { $lt: oneHourAgo } },
          { lastSyncAt: { $exists: false } },
          { syncStatus: 'error' },
        ],
      });

      return count;
    } catch (error) {
      logger.error('Error checking sync needed:', error);
      throw error;
    }
  }

  /**
   * Obtiene información de endpoints disponibles
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

  /**
   * Actualiza el precio de un producto en Amazon
   */
  async updateProductPrice(sellerSku, newPrice, context = {}) {
    try {
      if (!this.sellerId) {
        throw new Error('AMAZON_SELLER_ID no configurado');
      }

      logger.info(`Updating price for SKU ${sellerSku} to ${newPrice}€`);

      // Preparar el cuerpo de la solicitud para actualizar precio
      const requestBody = {
        productType: 'PRODUCT',
        patches: [
          {
            op: 'replace',
            path: '/attributes/purchasable_offer',
            value: [
              {
                audience: 'ALL',
                our_price: [
                  {
                    schedule: [
                      {
                        value_with_tax: newPrice,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      // Realizar la llamada a Amazon SP-API
      const result = await spApiClient.executeWithRetry(async (client) => {
        const response = await client.callAPI({
          operation: 'patchListingsItem',
          endpoint: 'listingsItems',
          path: {
            sellerId: this.sellerId,
            sku: sellerSku,
          },
          query: {
            marketplaceIds: [this.marketplaceId],
          },
          body: requestBody,
        });
        return response;
      });

      // Actualizar también en la base de datos local
      const localResult = await Product.findOneAndUpdate(
        { erp_sku: sellerSku },
        {
          amz_price: newPrice,
          amz_lastInventoryUpdate: new Date(),
          amz_syncStatus: 'synced',
          amz_syncError: '',
          'pricing.lastPriceUpdate': new Date(),
        },
        { new: true }
      );

      if (!localResult) {
        throw new Error('Producto no encontrado en base de datos local');
      }

      logger.info(`Successfully updated price for SKU ${sellerSku} to ${newPrice}€`);

      return {
        amazon: result,
        local: localResult,
        success: true,
      };
    } catch (error) {
      logger.error(`Error updating price for SKU ${sellerSku}:`, error);

      // Marcar error en base de datos local
      await Product.findOneAndUpdate(
        { erp_sku: sellerSku },
        {
          amz_syncStatus: 'error',
          amz_syncError: error.message,
          amz_lastInventoryUpdate: new Date(),
        }
      );

      throw error;
    }
  }
}

module.exports = new AmazonService();
