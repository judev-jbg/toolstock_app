const spApiClient = require('./spApiClient');
const Product = require('../../models/productModel');
const logger = require('../../utils/logger');

class AmazonService {
  constructor() {
    this.marketplaceId = process.env.AMAZON_MARKETPLACE_ID || 'A1RKKUPIHCS9HS'; // España
    this.sellerId = process.env.AMAZON_SELLER_ID;
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
   * Extrae la marca de los atributos (CORREGIDO)
   */
  extractBrandFromAttributes(attributes) {
    // Prioridad: manufacturer > brand > extraer del título

    if (
      attributes.manufacturer &&
      Array.isArray(attributes.manufacturer) &&
      attributes.manufacturer.length > 0
    ) {
      const manufacturerValue = attributes.manufacturer?.[0].value;
      if (manufacturerValue && manufacturerValue.trim()) {
        return manufacturerValue.trim();
      }
    }

    if (attributes.brand && Array.isArray(attributes.brand) && attributes.brand.length > 0) {
      const brandValue = attributes.brand?.[0].value;
      if (brandValue && brandValue.trim()) {
        return brandValue.trim();
      }
    }

    return attributes;
  }

  /**
   * Extrae el precio de offers o attributes (CORREGIDO)
   */
  extractPriceFromOffers(offers, attributes) {
    // Prioridad 1: offers array
    if (offers && Array.isArray(offers) && offers.length > 0) {
      // Buscar oferta B2C o ALL audience
      const b2cOffer = offers.find(
        (offer) => offer.offerType === 'B2C' || offer.audience?.value === 'ALL'
      );

      if (b2cOffer && b2cOffer.price?.amount) {
        const amount = parseFloat(b2cOffer.price.amount);
        if (!isNaN(amount) && amount > 0) {
          return amount;
        }
      }

      // Si no hay B2C, tomar la primera oferta disponible
      const firstOffer = offers[0];
      if (firstOffer && firstOffer.price?.amount) {
        const amount = parseFloat(firstOffer.price.amount);
        if (!isNaN(amount) && amount > 0) {
          return amount;
        }
      }
    }

    // Prioridad 2: purchasable_offer en attributes
    if (attributes.purchasable_offer && Array.isArray(attributes.purchasable_offer)) {
      for (const purchasableOffer of attributes.purchasable_offer) {
        // Buscar oferta para audience ALL
        if (purchasableOffer.audience === 'ALL' || !purchasableOffer.audience) {
          const priceSchedule = purchasableOffer.our_price?.[0]?.schedule?.[0];
          if (priceSchedule?.value_with_tax) {
            const amount = parseFloat(priceSchedule.value_with_tax);
            if (!isNaN(amount) && amount > 0) {
              return amount;
            }
          }
        }
      }

      // Si no encuentra audience ALL, tomar la primera disponible
      const firstPurchasableOffer = attributes.purchasable_offer[0];
      if (firstPurchasableOffer) {
        const priceSchedule = firstPurchasableOffer.our_price?.[0]?.schedule?.[0];
        if (priceSchedule?.value_with_tax) {
          const amount = parseFloat(priceSchedule.value_with_tax);
          if (!isNaN(amount) && amount > 0) {
            return amount;
          }
        }
      }
    }

    return 0;
  }

  /**
   * Extrae la cantidad de fulfillmentAvailability o attributes (CORREGIDO)
   */
  extractQuantityFromFulfillment(fulfillmentAvailability, attributes) {
    let totalQuantity = 0;

    // Prioridad 1: fulfillmentAvailability en el nivel superior
    if (fulfillmentAvailability && Array.isArray(fulfillmentAvailability)) {
      for (const fa of fulfillmentAvailability) {
        if (typeof fa.quantity === 'number' && fa.quantity >= 0) {
          totalQuantity += fa.quantity;
        }
      }
      if (totalQuantity > 0) {
        return totalQuantity;
      }
    }

    // Prioridad 2: fulfillment_availability en attributes
    if (attributes.fulfillment_availability && Array.isArray(attributes.fulfillment_availability)) {
      for (const fa of attributes.fulfillment_availability) {
        if (typeof fa.quantity === 'number' && fa.quantity >= 0) {
          totalQuantity += fa.quantity;
        }
      }
    }

    return totalQuantity;
  }

  /**
   * Determina el canal de fulfillment (CORREGIDO)
   */
  determineFulfillmentChannel(fulfillmentAvailability, attributes) {
    // Verificar fulfillmentAvailability
    if (fulfillmentAvailability && Array.isArray(fulfillmentAvailability)) {
      for (const fa of fulfillmentAvailability) {
        const code = fa.fulfillmentChannelCode;
        if (code === 'AMAZON' || code === 'AFN') {
          return 'AFN';
        }
      }
    }

    // Verificar attributes.fulfillment_availability
    if (attributes.fulfillment_availability && Array.isArray(attributes.fulfillment_availability)) {
      for (const fa of attributes.fulfillment_availability) {
        const code = fa.fulfillment_channel_code;
        if (code === 'AMAZON' || code === 'AFN') {
          return 'AFN';
        }
      }
    }

    return 'MFN';
  }

  /**
   * Mapea el estado de un listing de Amazon a nuestro formato (CORREGIDO)
   */
  mapListingStatus(amazonStatus) {
    if (!amazonStatus || !Array.isArray(amazonStatus) || amazonStatus.length === 0) {
      return 'Sin estado';
    }

    // El status viene como array: ["DISCOVERABLE"], ["ACTIVE"], etc.
    const status = amazonStatus[0];

    const statusMap = {
      ACTIVE: 'Active',
      DISCOVERABLE: 'Active', // Cambiado: DISCOVERABLE significa que está activo y visible
      SUPPRESSED: 'Inactive',
      BLOCKED: 'Inactive',
      INCOMPLETE: 'Incomplete',
      BUYABLE: 'Active',
    };

    return amazonStatus;
  }

  /**
   * Mapea el tipo de condición (CORREGIDO)
   */
  mapConditionType(conditionType) {
    if (!conditionType) return 'New';

    const conditionMap = {
      new_new: 'New',
      used_like_new: 'Used',
      used_very_good: 'Used',
      used_good: 'Used',
      used_acceptable: 'Used',
      collectible_like_new: 'Collectible',
      collectible_very_good: 'Collectible',
      collectible_good: 'Collectible',
      collectible_acceptable: 'Collectible',
      refurbished: 'Refurbished',
    };

    return conditionMap[conditionType] || 'New';
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

  valueHasChanged(currentValue, newValue) {
    // Normalizar valores undefined/null
    const current = currentValue ?? null;
    const newVal = newValue ?? null;

    // Comparación estricta
    if (current === newVal) {
      return false;
    }

    // Para números, strings, etc. - comparación adicional
    if (typeof current === typeof newVal) {
      return current !== newVal;
    }

    // Para arrays (si los tienes)
    if (Array.isArray(current) && Array.isArray(newVal)) {
      return JSON.stringify(current) !== JSON.stringify(newVal);
    }

    // Para objetos (si los tienes)
    if (
      typeof current === 'object' &&
      typeof newVal === 'object' &&
      current !== null &&
      newVal !== null
    ) {
      return JSON.stringify(current) !== JSON.stringify(newVal);
    }

    return true;
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
   * Solicita el reporte GET_MERCHANT_LISTINGS_ALL_DATA
   */
  async requestMerchantListingsReport() {
    try {
      logger.info('Requesting merchant listings report...');

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

      logger.info(`Report requested with ID: ${result.reportId}`);
      return result.reportId;
    } catch (error) {
      logger.error('Error requesting merchant listings report:', error);
      throw error;
    }
  }

  /**
   * Verifica el estado del reporte
   */
  async checkReportStatus(reportId) {
    try {
      const result = await spApiClient.executeWithRetry(async (client) => {
        const response = await client.callAPI({
          operation: 'getReport',
          endpoint: 'reports',
          path: {
            reportId: reportId,
          },
        });
        return response;
      });

      return result;
    } catch (error) {
      logger.error(`Error checking report status for ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * Espera a que el reporte esté listo y lo descarga
   */
  async waitForReportAndDownload(reportId, maxWaitMinutes = 10) {
    try {
      const maxAttempts = maxWaitMinutes * 2; // Revisar cada 30 segundos
      let attempts = 0;

      while (attempts < maxAttempts) {
        const reportStatus = await this.checkReportStatus(reportId);

        logger.info(`Report ${reportId} status: ${reportStatus.processingStatus}`);

        if (reportStatus.processingStatus === 'DONE') {
          if (reportStatus.reportDocumentId) {
            return await this.downloadReportDocument(reportStatus.reportDocumentId);
          } else {
            throw new Error('Report completed but no document ID available');
          }
        } else if (
          reportStatus.processingStatus === 'CANCELLED' ||
          reportStatus.processingStatus === 'FATAL'
        ) {
          throw new Error(`Report failed with status: ${reportStatus.processingStatus}`);
        }

        // Esperar 30 segundos antes del siguiente intento
        await new Promise((resolve) => setTimeout(resolve, 30000));
        attempts++;
      }

      throw new Error(`Report ${reportId} not ready after ${maxWaitMinutes} minutes`);
    } catch (error) {
      logger.error(`Error waiting for report ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * Descarga el documento del reporte
   */
  async downloadReportDocument(reportDocumentId) {
    try {
      // Primero obtener la URL de descarga
      const documentInfo = await spApiClient.executeWithRetry(async (client) => {
        const response = await client.callAPI({
          operation: 'getReportDocument',
          endpoint: 'reports',
          path: {
            reportDocumentId: reportDocumentId,
          },
        });
        return response;
      });

      // Descargar el contenido del reporte
      const axios = require('axios');
      const reportResponse = await axios.get(documentInfo.url, {
        timeout: 60000, // 60 segundos timeout
        responseType: 'text',
      });

      logger.info(`Downloaded report document: ${reportDocumentId}`);
      return reportResponse.data;
    } catch (error) {
      logger.error(`Error downloading report document ${reportDocumentId}:`, error);
      throw error;
    }
  }

  /**
   * Procesa el CSV del reporte de merchant listings
   */
  processListingsReportCSV(csvData) {
    try {
      const lines = csvData.split('\n');
      if (lines.length < 2) {
        throw new Error('Invalid CSV data - no data rows found');
      }

      // Obtener headers
      const headers = lines[0].split('\t').map((header) => header.trim());

      // Encontrar índices de columnas importantes
      const sellerSkuIndex = headers.findIndex((h) => h.toLowerCase().includes('seller-sku'));
      const statusIndex = headers.findIndex((h) => h.toLowerCase().includes('status'));
      const itemNameIndex = headers.findIndex((h) => h.toLowerCase().includes('item-name'));
      const priceIndex = headers.findIndex((h) => h.toLowerCase().includes('price'));
      const quantityIndex = headers.findIndex((h) => h.toLowerCase().includes('quantity'));

      if (sellerSkuIndex === -1 || statusIndex === -1) {
        throw new Error('Required columns (seller-sku, status) not found in report');
      }

      logger.info(
        `Found columns - SKU: ${sellerSkuIndex}, Status: ${statusIndex}, Name: ${itemNameIndex}, Price: ${priceIndex}, Quantity: ${quantityIndex}`
      );

      const products = [];

      // Procesar cada fila de datos
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const columns = line.split('\t');

        if (columns.length > sellerSkuIndex && columns.length > statusIndex) {
          const sellerSku = columns[sellerSkuIndex]?.trim();
          const status = columns[statusIndex]?.trim();

          if (sellerSku && status) {
            const productData = {
              sellerSku,
              status: this.mapReportStatus(status),
            };

            // Agregar campos opcionales si están disponibles
            if (itemNameIndex !== -1 && columns[itemNameIndex]) {
              productData.title = columns[itemNameIndex].trim();
            }
            if (priceIndex !== -1 && columns[priceIndex]) {
              const price = parseFloat(columns[priceIndex]);
              if (!isNaN(price)) {
                productData.price = price;
              }
            }
            if (quantityIndex !== -1 && columns[quantityIndex]) {
              const quantity = parseInt(columns[quantityIndex]);
              if (!isNaN(quantity)) {
                productData.quantity = quantity;
              }
            }

            products.push(productData);
          }
        }
      }

      logger.info(`Processed ${products.length} products from report`);
      return products;
    } catch (error) {
      logger.error('Error processing listings report CSV:', error);
      throw error;
    }
  }

  /**
   * Mapea el status del reporte al formato interno
   */
  mapReportStatus(reportStatus) {
    if (!reportStatus) return 'Unknown';

    const status = reportStatus.toUpperCase();
    const statusMap = {
      ACTIVE: 'Active',
      INACTIVE: 'Inactive',
      INCOMPLETE: 'Incomplete',
      SUPPRESSED: 'Inactive',
      BLOCKED: 'Inactive',
      BUYABLE: 'Active',
      DISCOVERABLE: 'Active',
    };

    return reportStatus;
  }

  /**
   * Actualiza el status de los productos usando el reporte
   */
  async updateProductStatusFromReport() {
    try {
      logger.info('Starting product status update from merchant listings report...');

      // 1. Solicitar el reporte
      const reportId = await this.requestMerchantListingsReport();

      // 2. Esperar a que esté listo y descargarlo
      const csvData = await this.waitForReportAndDownload(reportId);

      // 3. Procesar el CSV
      const reportProducts = this.processListingsReportCSV(csvData);

      // 4. Actualizar productos en la base de datos
      let updated = 0;
      let errors = 0;

      for (const reportProduct of reportProducts) {
        try {
          const updateData = {
            status: reportProduct.status,
            lastSyncAt: new Date(),
            syncStatus: 'synced',
          };

          // Agregar campos opcionales si están disponibles
          if (reportProduct.title) {
            updateData.title = reportProduct.title;
          }
          if (reportProduct.price !== undefined) {
            updateData.price = reportProduct.price;
          }
          if (reportProduct.quantity !== undefined) {
            updateData.quantity = reportProduct.quantity;
          }

          await Product.findOneAndUpdate({ sellerSku: reportProduct.sellerSku }, updateData, {
            new: true,
          });

          updated++;
        } catch (error) {
          logger.error(`Error updating product ${reportProduct.sellerSku}:`, error);
          errors++;
        }
      }

      logger.info(`Status update completed: ${updated} updated, ${errors} errors`);
      return { updated, errors };
    } catch (error) {
      logger.error('Error updating product status from report:', error);
      throw error;
    }
  }

  /**
   * Actualiza el stock de un producto en Amazon (NUEVO - IMPLEMENTACIÓN REAL)
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
   * Actualiza stock de múltiples productos en Amazon (MEJORADO)
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
   * Mapea un item de inventario FBA a formato de producto (MANTENER)
   */
  mapFBAItemToProduct(fbaItem) {
    return {
      asin: fbaItem.asin || '',
      sellerSku: fbaItem.sellerSku,
      title: fbaItem.productName || fbaItem.sellerSku,
      brand: this.extractBrandFromTitle(fbaItem.productName || ''),
      quantity: fbaItem.totalQuantity || 0,
      condition: fbaItem.condition || 'New',
      fulfillmentChannel: 'AFN', // Amazon Fulfillment Network (FBA)
      status: this.determineProductStatus(fbaItem),
      price: 0,
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

  async upsertProduct(productData) {
    try {
      const result = await Product.findOneAndUpdate(
        { sellerSku: productData.sellerSku },
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

      return result;
    } catch (error) {
      // Marcar producto con error
      await Product.findOneAndUpdate(
        { sellerSku: productData.sellerSku },
        {
          sellerSku: productData.sellerSku,
          asin: productData.asin || '',
          title: productData.title || productData.sellerSku,
          syncStatus: 'error',
          syncError: error.message,
          lastSyncAt: new Date(),
        },
        { upsert: true }
      );

      throw error;
    }
  }

  determineProductStatus(item) {
    if (item.totalQuantity !== undefined) {
      if (!item.asin || !item.productName) {
        return 'Incomplete';
      }
      return item.totalQuantity > 0 ? 'Active' : 'Inactive';
    }
    return 'Active';
  }

  extractBrandFromTitle(title) {
    if (!title) return '';

    const cleanTitle = title.trim();
    const words = cleanTitle.split(/[\s\-\,]+/);
    const commonWords = [
      'the',
      'and',
      'for',
      'with',
      'pack',
      'set',
      'kit',
      'de',
      'del',
      'la',
      'el',
    ];

    const potentialBrand = words.find(
      (word) => word.length > 2 && !commonWords.includes(word.toLowerCase()) && isNaN(word)
    );

    return potentialBrand || words[0] || '';
  }

  /**
   * Obtiene información detallada de un producto por ASIN
   */
  async getCatalogItemByAsin(asin) {
    try {
      const result = await spApiClient.executeWithRetry(async (client) => {
        const response = await client.callAPI({
          operation: 'getCatalogItem',
          endpoint: 'catalogItems',
          path: {
            asin: asin,
          },
          query: {
            marketplaceIds: [this.marketplaceId],
            includedData: ['attributes', 'images', 'productTypes', 'salesRanks'],
          },
        });
        return response;
      });

      return result;
    } catch (error) {
      logger.error(`Error getting catalog item for ASIN ${asin}:`, error);
      throw error;
    }
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
   * Función de prueba para obtener órdenes
   */
  async getOrders(createdAfter) {
    try {
      // Verificar que tenemos marketplace ID configurado
      if (!this.marketplaceId) {
        throw new Error('AMAZON_MARKETPLACE_ID no configurado');
      }

      const result = await spApiClient.executeWithRetry(async (client) => {
        const queryParams = {
          marketplaceIds: [this.marketplaceId],
          createdAfter:
            createdAfter || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          orderStatuses: ['Unshipped', 'PartiallyShipped'],
          maxResultsPerPage: 10,
        };

        logger.info('Getting orders with params:', queryParams);

        const response = await client.callAPI({
          operation: 'getOrders',
          endpoint: 'orders',
          query: queryParams,
        });
        return response;
      });

      logger.info(`Retrieved ${result.orders?.length || 0} orders`);
      return result.orders || [];
    } catch (error) {
      logger.error('Error getting orders:', error);
      return [];
    }
  }
}

module.exports = new AmazonService();
